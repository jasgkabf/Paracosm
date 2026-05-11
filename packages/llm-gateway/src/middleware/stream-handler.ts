import type { LLMStreamChunk } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';
import type { Middleware, MiddlewareContext } from './middleware-pipeline.js';

const logger = createLogger('StreamHandler');

export interface StreamBuffer {
  chunks: LLMStreamChunk[];
  totalContent: string;
  startTime: number;
  lastChunkTime: number;
  chunkCount: number;
  totalTokens: number;
  isComplete: boolean;
  finishReason: string | null;
}

export interface StreamTransformRule {
  field: string;
  transform: (value: unknown) => unknown;
}

export interface BackpressureConfig {
  maxBufferSize: number;
  highWaterMark: number;
  lowWaterMark: number;
  pauseThreshold: number;
  resumeThreshold: number;
}

export interface StreamAbortOptions {
  reason: string;
  flushBuffer: boolean;
  emitEnd: boolean;
}

export class StreamHandler implements Middleware {
  name = 'stream-handler';
  order = 30;

  private buffers: Map<string, StreamBuffer> = new Map();
  private maxBufferSize: number = 1000;
  private backpressureConfig: BackpressureConfig;
  private pausedStreams: Set<string> = new Set();
  private abortedStreams: Set<string> = new Set();
  private transformRules: StreamTransformRule[] = [];
  private streamCallbacks: Map<string, {
    onData?: (chunk: LLMStreamChunk) => void;
    onComplete?: (buffer: StreamBuffer) => void;
    onError?: (error: Error) => void;
  }> = new Map();
  private streamTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private streamTimeoutMs: number = 120000;
  private chunkInterval: Map<string, number[]> = new Map();

  constructor(config?: {
    maxBufferSize?: number;
    backpressure?: Partial<BackpressureConfig>;
    streamTimeoutMs?: number;
  }) {
    this.maxBufferSize = config?.maxBufferSize ?? 1000;
    this.streamTimeoutMs = config?.streamTimeoutMs ?? 120000;
    this.backpressureConfig = {
      maxBufferSize: config?.backpressure?.maxBufferSize ?? 10000,
      highWaterMark: config?.backpressure?.highWaterMark ?? 8000,
      lowWaterMark: config?.backpressure?.lowWaterMark ?? 2000,
      pauseThreshold: config?.backpressure?.pauseThreshold ?? 0.8,
      resumeThreshold: config?.backpressure?.resumeThreshold ?? 0.3,
    };
  }

  async onStreamChunk(context: MiddlewareContext, chunk: LLMStreamChunk): Promise<MiddlewareContext> {
    const requestId = chunk.requestId;

    if (this.abortedStreams.has(requestId)) {
      logger.debug('Ignoring chunk for aborted stream', { requestId });
      return context;
    }

    const transformedChunk = this.transform(chunk);

    const buffer = this.parse(requestId, transformedChunk);

    const now = Date.now();
    if (!this.chunkInterval.has(requestId)) {
      this.chunkInterval.set(requestId, []);
    }
    const intervals = this.chunkInterval.get(requestId)!;
    if (buffer.lastChunkTime > 0) {
      intervals.push(now - buffer.lastChunkTime);
      if (intervals.length > 100) {
        intervals.splice(0, intervals.length - 100);
      }
    }
    buffer.lastChunkTime = now;

    if (this.shouldApplyBackpressure(requestId, buffer)) {
      this.pausedStreams.add(requestId);
      logger.warn('Backpressure applied to stream', {
        requestId,
        bufferSize: buffer.chunkCount,
      });
      context.metadata.streamPaused = true;
    }

    const callbacks = this.streamCallbacks.get(requestId);
    if (callbacks?.onData) {
      try {
        callbacks.onData(transformedChunk);
      } catch (error) {
        logger.error('Stream onData callback error', {
          requestId,
          error: (error as Error).message,
        });
      }
    }

    this.resetStreamTimeout(requestId);

    if (chunk.finishReason) {
      buffer.isComplete = true;
      buffer.finishReason = chunk.finishReason;
      this.clearStreamTimeout(requestId);

      if (callbacks?.onComplete) {
        try {
          callbacks.onComplete(buffer);
        } catch (error) {
          logger.error('Stream onComplete callback error', {
            requestId,
            error: (error as Error).message,
          });
        }
      }

      logger.info('Stream completed', {
        requestId,
        totalChunks: buffer.chunkCount,
        totalContent: buffer.totalContent.length,
        durationMs: now - buffer.startTime,
      });
    }

    context.metadata.streamBuffer = buffer;
    context.streamChunks = buffer.chunks;
    return context;
  }

  async beforeRequest(context: MiddlewareContext): Promise<MiddlewareContext> {
    const isStreaming = context.request.metadata.streaming as boolean ?? false;
    if (isStreaming) {
      this.initBuffer(context.request.id);
      this.setStreamTimeout(context.request.id);
    }
    context.metadata.isStreaming = isStreaming;
    return context;
  }

  async afterResponse(context: MiddlewareContext): Promise<MiddlewareContext> {
    const requestId = context.request.id;
    const buffer = this.buffers.get(requestId);
    if (buffer && buffer.isComplete) {
      context.metadata.streamDurationMs = buffer.lastChunkTime - buffer.startTime;
      context.metadata.streamChunkCount = buffer.chunkCount;
    }
    this.cleanup(requestId);
    return context;
  }

  async onError(context: MiddlewareContext, error: Error): Promise<MiddlewareContext> {
    const requestId = context.request.id;
    const callbacks = this.streamCallbacks.get(requestId);
    if (callbacks?.onError) {
      try {
        callbacks.onError(error);
      } catch (err) {
        logger.error('Stream onError callback error', { error: (err as Error).message });
      }
    }
    this.cleanup(requestId);
    return context;
  }

  parse(requestId: string, chunk: LLMStreamChunk): StreamBuffer {
    let buffer = this.buffers.get(requestId);
    if (!buffer) {
      buffer = this.initBuffer(requestId);
    }

    buffer.chunks.push(chunk);
    buffer.totalContent += chunk.delta || chunk.content || '';
    buffer.chunkCount++;

    if (chunk.usage?.totalTokens) {
      buffer.totalTokens = chunk.usage.totalTokens;
    }

    if (buffer.chunks.length > this.maxBufferSize) {
      buffer.chunks = buffer.chunks.slice(-this.maxBufferSize);
    }

    this.buffers.set(requestId, buffer);
    return buffer;
  }

  buffer(requestId: string): StreamBuffer | undefined {
    return this.buffers.get(requestId);
  }

  transform(chunk: LLMStreamChunk): LLMStreamChunk {
    let transformed = { ...chunk };

    for (const rule of this.transformRules) {
      const fieldValue = (transformed as Record<string, unknown>)[rule.field];
      if (fieldValue !== undefined) {
        (transformed as Record<string, unknown>)[rule.field] = rule.transform(fieldValue);
      }
    }

    return transformed;
  }

  addTransformRule(rule: StreamTransformRule): void {
    this.transformRules.push(rule);
  }

  removeTransformRule(field: string): boolean {
    const index = this.transformRules.findIndex((r) => r.field === field);
    if (index === -1) return false;
    this.transformRules.splice(index, 1);
    return true;
  }

  backpressure(requestId: string): {
    isPaused: boolean;
    bufferUtilization: number;
    averageChunkInterval: number;
  } {
    const buffer = this.buffers.get(requestId);
    const isPaused = this.pausedStreams.has(requestId);
    const bufferUtilization = buffer
      ? buffer.chunkCount / this.backpressureConfig.maxBufferSize
      : 0;
    const intervals = this.chunkInterval.get(requestId) ?? [];
    const averageChunkInterval = intervals.length > 0
      ? intervals.reduce((sum, i) => sum + i, 0) / intervals.length
      : 0;

    return { isPaused, bufferUtilization, averageChunkInterval };
  }

  shouldApplyBackpressure(requestId: string, buffer: StreamBuffer): boolean {
    const utilization = buffer.chunkCount / this.backpressureConfig.maxBufferSize;
    return utilization >= this.backpressureConfig.pauseThreshold;
  }

  resumeStream(requestId: string): boolean {
    if (!this.pausedStreams.has(requestId)) return false;
    const buffer = this.buffers.get(requestId);
    if (!buffer) return false;

    const utilization = buffer.chunkCount / this.backpressureConfig.maxBufferSize;
    if (utilization <= this.backpressureConfig.resumeThreshold) {
      this.pausedStreams.delete(requestId);
      logger.info('Stream resumed', { requestId });
      return true;
    }
    return false;
  }

  abort(requestId: string, options?: Partial<StreamAbortOptions>): StreamBuffer | undefined {
    const opts: StreamAbortOptions = {
      reason: options?.reason ?? 'Manual abort',
      flushBuffer: options?.flushBuffer ?? false,
      emitEnd: options?.emitEnd ?? true,
    };

    this.abortedStreams.add(requestId);
    this.pausedStreams.delete(requestId);
    this.clearStreamTimeout(requestId);

    const buffer = this.buffers.get(requestId);
    if (buffer) {
      if (opts.flushBuffer) {
        buffer.isComplete = true;
        buffer.finishReason = 'aborted';
      }

      if (opts.emitEnd) {
        const callbacks = this.streamCallbacks.get(requestId);
        if (callbacks?.onComplete) {
          callbacks.onComplete(buffer);
        }
      }

      logger.info('Stream aborted', {
        requestId,
        reason: opts.reason,
        chunksReceived: buffer.chunkCount,
      });
    }

    this.cleanup(requestId);
    return buffer;
  }

  registerCallbacks(
    requestId: string,
    callbacks: {
      onData?: (chunk: LLMStreamChunk) => void;
      onComplete?: (buffer: StreamBuffer) => void;
      onError?: (error: Error) => void;
    },
  ): void {
    this.streamCallbacks.set(requestId, callbacks);
  }

  unregisterCallbacks(requestId: string): void {
    this.streamCallbacks.delete(requestId);
  }

  getActiveStreams(): string[] {
    return Array.from(this.buffers.keys());
  }

  getPausedStreams(): string[] {
    return Array.from(this.pausedStreams);
  }

  getAbortedStreams(): string[] {
    return Array.from(this.abortedStreams);
  }

  getStreamStats(requestId: string): {
    chunkCount: number;
    totalContentLength: number;
    durationMs: number;
    isComplete: boolean;
    isPaused: boolean;
    isAborted: boolean;
    averageChunkInterval: number;
  } | undefined {
    const buffer = this.buffers.get(requestId);
    if (!buffer) return undefined;

    const intervals = this.chunkInterval.get(requestId) ?? [];
    return {
      chunkCount: buffer.chunkCount,
      totalContentLength: buffer.totalContent.length,
      durationMs: Date.now() - buffer.startTime,
      isComplete: buffer.isComplete,
      isPaused: this.pausedStreams.has(requestId),
      isAborted: this.abortedStreams.has(requestId),
      averageChunkInterval: intervals.length > 0
        ? intervals.reduce((sum, i) => sum + i, 0) / intervals.length
        : 0,
    };
  }

  private initBuffer(requestId: string): StreamBuffer {
    const buffer: StreamBuffer = {
      chunks: [],
      totalContent: '',
      startTime: Date.now(),
      lastChunkTime: 0,
      chunkCount: 0,
      totalTokens: 0,
      isComplete: false,
      finishReason: null,
    };
    this.buffers.set(requestId, buffer);
    return buffer;
  }

  private cleanup(requestId: string): void {
    this.buffers.delete(requestId);
    this.pausedStreams.delete(requestId);
    this.chunkInterval.delete(requestId);
    this.streamCallbacks.delete(requestId);
    this.clearStreamTimeout(requestId);
  }

  private setStreamTimeout(requestId: string): void {
    this.clearStreamTimeout(requestId);
    const timeoutId = setTimeout(() => {
      logger.warn('Stream timeout', { requestId, timeoutMs: this.streamTimeoutMs });
      this.abort(requestId, { reason: 'Stream timeout', flushBuffer: true, emitEnd: true });
    }, this.streamTimeoutMs);
    this.streamTimeouts.set(requestId, timeoutId);
  }

  private resetStreamTimeout(requestId: string): void {
    this.setStreamTimeout(requestId);
  }

  private clearStreamTimeout(requestId: string): void {
    const timeoutId = this.streamTimeouts.get(requestId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.streamTimeouts.delete(requestId);
    }
  }
}
