import type { LLMUsage } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";
import type { ResponseMappingInternal, JSONPathMappingInternal } from "./types.js";

const logger = new Logger("ResponseMapper");

export interface MappedResponse {
  id?: string;
  content: string | null;
  usage?: LLMUsage;
  finishReason?: string;
  functionCall?: { name: string; arguments: string } | null;
}

export interface MappedStreamChunk {
  content: string | null;
  usage?: LLMUsage | null;
  finishReason?: string | null;
}

export interface MappedError {
  code: string;
  message: string;
}

export class ResponseMapper {
  private mapping: ResponseMappingInternal;

  constructor(mapping: ResponseMappingInternal) {
    this.mapping = mapping;
  }

  mapResponse(data: Record<string, unknown>): MappedResponse {
    const content = this.extractByPath(data, this.mapping.contentPath) as string | null;
    const usage = this.extractUsage(data);
    const finishReason = this.extractByPath(data, this.mapping.finishReasonPath) as string | undefined;
    const id = this.extractByPath(data, "id") as string | undefined;

    let functionCall: { name: string; arguments: string } | null = null;
    if (this.mapping.functionCallPath) {
      const fcData = this.extractByPath(data, this.mapping.functionCallPath);
      if (fcData && typeof fcData === "object") {
        const name = this.mapping.functionCallNamePath
          ? (this.extractByPath(fcData as Record<string, unknown>, this.mapping.functionCallNamePath) as string)
          : "";
        const args = this.mapping.functionCallArgumentsPath
          ? (this.extractByPath(fcData as Record<string, unknown>, this.mapping.functionCallArgumentsPath) as string)
          : "{}";
        functionCall = { name, arguments: typeof args === "string" ? args : JSON.stringify(args) };
      }
    }

    for (const [key, mapping] of Object.entries(this.mapping.customPaths)) {
      const value = this.extractByPath(data, mapping.path);
      if (value === undefined && mapping.required) {
        logger.warn(`Required custom response path missing: ${mapping.path}`);
      }
    }

    return {
      id,
      content: typeof content === "string" ? content : content !== null && content !== undefined ? String(content) : null,
      usage,
      finishReason: finishReason ?? "stop",
      functionCall,
    };
  }

  mapStreamChunk(data: Record<string, unknown>): MappedStreamChunk {
    const content = this.extractByPath(data, this.mapping.contentPath) as string | null;
    let usage: LLMUsage | null = null;

    if (this.mapping.usagePath) {
      usage = this.extractUsage(data) ?? null;
    }

    const finishReason = this.extractByPath(data, this.mapping.finishReasonPath) as string | null;

    return {
      content: typeof content === "string" ? content : content !== null && content !== undefined ? String(content) : null,
      usage,
      finishReason,
    };
  }

  extractError(rawBody: string): MappedError {
    try {
      const data = JSON.parse(rawBody) as Record<string, unknown>;
      const code = this.mapping.errorCodePath ? (this.extractByPath(data, this.mapping.errorCodePath) as string ?? "UNKNOWN") : "UNKNOWN";
      const message = this.extractByPath(data, this.mapping.errorMessagePath) as string ?? rawBody.substring(0, 200);
      return { code, message };
    } catch {
      return { code: "PARSE_ERROR", message: rawBody.substring(0, 200) };
    }
  }

  extractUsage(data: Record<string, unknown>): LLMUsage | undefined {
    if (!this.mapping.usagePath) {
      return undefined;
    }

    const usageData = this.extractByPath(data, this.mapping.usagePath);
    if (!usageData || typeof usageData !== "object") {
      return undefined;
    }

    const usageObj = usageData as Record<string, unknown>;
    const promptTokens = this.mapping.promptTokensPath
      ? (this.extractByPath(usageObj, this.mapping.promptTokensPath) as number) ?? 0
      : (usageObj.prompt_tokens as number) ?? (usageObj.promptTokens as number) ?? 0;
    const completionTokens = this.mapping.completionTokensPath
      ? (this.extractByPath(usageObj, this.mapping.completionTokensPath) as number) ?? 0
      : (usageObj.completion_tokens as number) ?? (usageObj.completionTokens as number) ?? 0;
    const totalTokens = this.mapping.totalTokensPath
      ? (this.extractByPath(usageObj, this.mapping.totalTokensPath) as number) ?? 0
      : (usageObj.total_tokens as number) ?? (usageObj.totalTokens as number) ?? (promptTokens + completionTokens);

    return { promptTokens, completionTokens, totalTokens };
  }

  extractByPath(data: Record<string, unknown>, path: string | null): unknown {
    if (!path) return undefined;
    const parts = path.split(".");
    let current: unknown = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === "object" && !Array.isArray(current)) {
        current = (current as Record<string, unknown>)[part];
      } else if (Array.isArray(current)) {
        const index = parseInt(part, 10);
        if (!isNaN(index) && index >= 0 && index < current.length) {
          current = current[index];
        } else {
          return undefined;
        }
      } else {
        return undefined;
      }
    }

    return current;
  }
}
