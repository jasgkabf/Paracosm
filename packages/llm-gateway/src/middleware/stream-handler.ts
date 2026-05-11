import { EventEmitter } from "node:events";
import { Result, ok, err } from "@paracosm/shared";
import { LLMError } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";

const logger = new Logger("StreamHandler");

export interface StreamChunk {
  content: string;
  index: number;
  finishReason: string | null;
  usage: Record<string, unknown> | null;
}

export class StreamHandler extends EventEmitter {
  private activeStreams: Map<string, { controller: AbortController; startTime: number }> = new Map();
  private bufferSizes: Map<string, number> = new Map();
  private maxBufferSize: number = 1024 * 1024;
  private backpressureThreshold: number = 512 * 1024;

  parse(rawChunk: string, format: "sse" | "ndjson" = "sse"): StreamChunk[] {
    const chunks: StreamChunk[] = [];

    if (format === "sse") {
      const lines = rawChunk.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data) as Record<string, unknown>;
          chunks.push(this.extractChunk(parsed, chunks.length));
        } catch {
          continue;
        }
      }
    } else if (format === "ndjson") {
      const lines = rawChunk.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed) as Record<string, unknown>;
          chunks.push(this.extractChunk(parsed, chunks.length));
        } catch {
          continue;
        }
      }
    }

    return chunks;
  }

  buffer(streamId: string, data: string): number {
    const currentSize = this.bufferSizes.get(streamId) ?? 0;
    const newSize = currentSize + data.length;
    this.bufferSizes.set(streamId, newSize);

    if (newSize > this.maxBufferSize) {
      this.emit("buffer_overflow", { streamId, size: newSize, max: this.maxBufferSize });
      logger.warn(`Buffer overflow for stream ${streamId}: ${newSize} bytes`);
    }

    return newSize;
  }

  transform(chunks: StreamChunk[], transformer: (chunk: StreamChunk) => StreamChunk): StreamChunk[] {
    return chunks.map(transformer);
  }

  backpressure(streamId: string): boolean {
    const bufferSize = this.bufferSizes.get(streamId) ?? 0;
    return bufferSize > this.backpressureThreshold;
  }

  abort(streamId: string): boolean {
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      stream.controller.abort();
      this.activeStreams.delete(streamId);
      this.bufferSizes.delete(streamId);
      this.emit("aborted", { streamId });
      return true;
    }
    return false;
  }

  async reconnect(
    streamId: string,
    connectFn: () => Promise<ReadableStream<Uint8Array>>,
    maxAttempts: number = 3,
    delayMs: number = 1000
  ): Promise<Result<ReadableStream<Uint8Array>, Error>> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const stream = await connectFn();
        const controller = new AbortController();
        this.activeStreams.set(streamId, { controller, startTime: Date.now() });
        this.emit("reconnected", { streamId, attempt });
        return ok(stream);
      } catch (error) {
        if (attempt === maxAttempts) {
          return err(error instanceof Error ? error : new Error(String(error)));
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
    return err(new Error("Reconnect failed"));
  }

  registerStream(streamId: string, controller: AbortController): void {
    this.activeStreams.set(streamId, { controller, startTime: Date.now() });
    this.bufferSizes.set(streamId, 0);
  }

  unregisterStream(streamId: string): void {
    this.activeStreams.delete(streamId);
    this.bufferSizes.delete(streamId);
  }

  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }

  private extractChunk(parsed: Record<string, unknown>, index: number): StreamChunk {
    const choices = parsed.choices as Record<string, unknown>[] | undefined;
    const delta = choices?.[0]?.delta as Record<string, unknown> | undefined;
    const message = parsed.message as Record<string, unknown> | undefined;

    const content = (delta?.content as string) ?? (message?.content as string) ?? "";
    const finishReason = (choices?.[0]?.finish_reason as string) ?? (parsed.done ? "stop" : null) ?? null;
    const usage = (parsed.usage as Record<string, unknown>) ?? null;

    return { content, index, finishReason, usage };
  }
}
