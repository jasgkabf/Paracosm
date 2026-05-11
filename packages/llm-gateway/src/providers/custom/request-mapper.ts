import type { LLMMessage } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";
import type { RequestMappingInternal, JSONPathMappingInternal } from "./types.js";

const logger = new Logger("RequestMapper");

export interface RequestBuildOptions {
  model: string;
  temperature: number;
  maxTokens: number;
  stream: boolean;
  [key: string]: unknown;
}

export class RequestMapper {
  private mapping: RequestMappingInternal;

  constructor(mapping: RequestMappingInternal) {
    this.mapping = mapping;
  }

  buildRequest(messages: LLMMessage[], options: RequestBuildOptions): {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  } {
    const body = this.buildBody(messages, options);
    const headers = this.buildHeaders();
    const url = this.buildUrl(options);
    return { url, headers, body };
  }

  buildBody(messages: LLMMessage[], options: RequestBuildOptions): Record<string, unknown> {
    const template = JSON.parse(JSON.stringify(this.mapping.bodyTemplate));
    this.setNestedValue(template, this.mapping.messagePath, this.formatMessages(messages));
    this.setNestedValue(template, this.mapping.modelPath, options.model);
    this.setNestedValue(template, this.mapping.temperaturePath, options.temperature);
    this.setNestedValue(template, this.mapping.maxTokensPath, options.maxTokens);
    this.setNestedValue(template, this.mapping.streamPathParam, options.stream);

    for (const [key, mapping] of Object.entries(this.mapping.customPaths)) {
      const value = this.resolveCustomPath(mapping, options);
      if (value !== undefined) {
        this.setNestedValue(template, mapping.path, value);
      }
    }

    return template;
  }

  buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    for (const [key, value] of Object.entries(this.mapping.headers)) {
      headers[key] = this.renderTemplate(value, {});
    }
    return headers;
  }

  buildUrl(options: RequestBuildOptions): string {
    let endpoint = this.mapping.endpoint;
    for (const [key, value] of Object.entries(options)) {
      endpoint = endpoint.replace(`{${key}}`, String(value));
    }
    return endpoint;
  }

  renderTemplate(template: string, variables: Record<string, unknown>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
    }
    return result;
  }

  private formatMessages(messages: LLMMessage[]): Record<string, unknown>[] {
    return messages.map((m) => {
      const formatted: Record<string, unknown> = {
        role: m.role,
        content: m.content,
      };
      if (m.name) {
        formatted.name = m.name;
      }
      if (m.functionCall) {
        formatted.function_call = {
          name: m.functionCall.name,
          arguments: m.functionCall.arguments,
        };
      }
      return formatted;
    });
  }

  private resolveCustomPath(mapping: JSONPathMappingInternal, options: Record<string, unknown>): unknown {
    const optionKey = mapping.path.split(".").pop() ?? mapping.path;
    const value = options[optionKey];
    if (value !== undefined) {
      return value;
    }
    if (mapping.defaultValue !== undefined) {
      return mapping.defaultValue;
    }
    if (mapping.required) {
      logger.warn(`Required custom path value missing: ${mapping.path}`);
    }
    return undefined;
  }

  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split(".");
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  }
}
