import { Logger } from "@paracosm/shared";
import type { StreamConfigInternal } from "./types.js";

const logger = new Logger("StreamParser");

export interface ParsedChunk {
  data: Record<string, unknown>;
  raw: string;
}

export class StreamParser {
  private config: StreamConfigInternal;
  private buffer: string = "";

  constructor(config: StreamConfigInternal) {
    this.config = config;
  }

  parse(input: string): ParsedChunk[] {
    this.buffer += input;
    const chunks: ParsedChunk[] = [];

    switch (this.config.streamFormat) {
      case "sse":
        chunks.push(...this.parseSSE());
        break;
      case "ndjson":
        chunks.push(...this.parseNDJSON());
        break;
      case "websocket":
        chunks.push(...this.parseWebSocket());
        break;
      default:
        chunks.push(...this.parseSSE());
    }

    return chunks;
  }

  parseSSE(): ParsedChunk[] {
    const chunks: ParsedChunk[] = [];
    const lines = this.buffer.split("\n");
    this.buffer = "";

    let currentData = "";
    let remaining = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line === "") {
        if (currentData) {
          const parsed = this.parseSSEData(currentData);
          if (parsed) {
            chunks.push(parsed);
          }
          currentData = "";
        }
        continue;
      }

      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") {
          continue;
        }
        currentData = data;
      } else if (line.startsWith("event: ")) {
        continue;
      } else if (line.startsWith("id: ") || line.startsWith("retry: ")) {
        continue;
      } else if (line.startsWith(":")) {
        continue;
      } else {
        remaining += (remaining ? "\n" : "") + line;
      }
    }

    if (remaining) {
      this.buffer = remaining;
    }

    return chunks;
  }

  parseNDJSON(): ParsedChunk[] {
    const chunks: ParsedChunk[] = [];
    const lines = this.buffer.split("\n");
    const lastLine = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const data = JSON.parse(trimmed) as Record<string, unknown>;
        chunks.push({ data, raw: trimmed });
      } catch {
        logger.warn(`Failed to parse NDJSON line: ${trimmed.substring(0, 100)}`);
      }
    }

    if (lastLine !== undefined && lastLine.trim() !== "") {
      this.buffer = lastLine;
    } else {
      this.buffer = "";
    }

    return chunks;
  }

  parseWebSocket(): ParsedChunk[] {
    const chunks: ParsedChunk[] = [];
    const delimiter = this.config.delimiter || "\n";
    const messages = this.buffer.split(delimiter);
    const lastMessage = messages.pop();

    for (const message of messages) {
      const trimmed = message.trim();
      if (!trimmed) continue;

      try {
        const data = JSON.parse(trimmed) as Record<string, unknown>;
        chunks.push({ data, raw: trimmed });
      } catch {
        logger.warn(`Failed to parse WebSocket message: ${trimmed.substring(0, 100)}`);
      }
    }

    if (lastMessage !== undefined) {
      this.buffer = lastMessage;
    } else {
      this.buffer = "";
    }

    return chunks;
  }

  parseCustomDelimiter(delimiter: string): ParsedChunk[] {
    const chunks: ParsedChunk[] = [];
    const messages = this.buffer.split(delimiter);
    const lastMessage = messages.pop();

    for (const message of messages) {
      const trimmed = message.trim();
      if (!trimmed) continue;

      try {
        const data = JSON.parse(trimmed) as Record<string, unknown>;
        chunks.push({ data, raw: trimmed });
      } catch {
        chunks.push({ data: { raw: trimmed }, raw: trimmed });
      }
    }

    if (lastMessage !== undefined) {
      this.buffer = lastMessage;
    } else {
      this.buffer = "";
    }

    return chunks;
  }

  getRemainingBuffer(): string {
    return this.buffer;
  }

  clearBuffer(): void {
    this.buffer = "";
  }

  private parseSSEData(data: string): ParsedChunk | null {
    try {
      const parsed = JSON.parse(data) as Record<string, unknown>;
      return { data: parsed, raw: data };
    } catch {
      return null;
    }
  }
}
