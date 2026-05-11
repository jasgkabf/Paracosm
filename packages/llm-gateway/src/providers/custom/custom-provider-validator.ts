import type { CustomProviderConfig, ProviderTemplate } from "@paracosm/shared";
import { Result, ok, err } from "@paracosm/shared";
import { ValidationError } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";
import type { CustomProviderInternalConfig } from "./types.js";

const logger = new Logger("CustomProviderValidator");

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class CustomProviderValidator {
  validateConfig(config: CustomProviderInternalConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.providerId || config.providerId.length === 0) {
      errors.push("providerId is required");
    }

    if (!config.name || config.name.length === 0) {
      errors.push("name is required");
    }

    if (!config.baseUrl || config.baseUrl.length === 0) {
      errors.push("baseUrl is required");
    } else {
      try {
        new URL(config.baseUrl);
      } catch {
        errors.push("baseUrl must be a valid URL");
      }
    }

    if (!config.authentication) {
      errors.push("authentication is required");
    } else {
      if (!["bearer", "api_key", "basic", "custom"].includes(config.authentication.type)) {
        errors.push(`Invalid authentication type: ${config.authentication.type}`);
      }
      if (!config.authentication.headerName) {
        warnings.push("authentication.headerName is empty, using default");
      }
    }

    if (!config.requestMapping) {
      errors.push("requestMapping is required");
    } else {
      if (!config.requestMapping.endpoint) {
        errors.push("requestMapping.endpoint is required");
      }
      if (!["GET", "POST", "PUT", "PATCH"].includes(config.requestMapping.method)) {
        errors.push(`Invalid request method: ${config.requestMapping.method}`);
      }
      if (!config.requestMapping.messagePath) {
        errors.push("requestMapping.messagePath is required");
      }
      if (!config.requestMapping.modelPath) {
        errors.push("requestMapping.modelPath is required");
      }
    }

    if (!config.responseMapping) {
      errors.push("responseMapping is required");
    } else {
      if (!config.responseMapping.contentPath) {
        errors.push("responseMapping.contentPath is required");
      }
      if (!config.responseMapping.errorPath) {
        warnings.push("responseMapping.errorPath is not set, error extraction may fail");
      }
    }

    if (!config.streamConfig) {
      warnings.push("streamConfig is not set, streaming will be disabled");
    } else {
      if (!["sse", "websocket", "ndjson"].includes(config.streamConfig.streamFormat)) {
        errors.push(`Invalid stream format: ${config.streamConfig.streamFormat}`);
      }
    }

    if (config.timeoutMs < 1000) {
      warnings.push("timeoutMs is very low (< 1000ms), requests may timeout frequently");
    }

    if (config.rateLimitRpm < 1) {
      warnings.push("rateLimitRpm is less than 1");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async testConnectivity(config: CustomProviderInternalConfig): Promise<Result<{ connected: boolean; latencyMs: number; error?: string }, Error>> {
    const startTime = Date.now();
    try {
      const url = config.healthCheckEndpoint
        ? `${config.baseUrl}${config.healthCheckEndpoint}`
        : config.baseUrl;

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      this.injectAuth(headers, config);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      return ok({
        connected: response.ok || response.status === 401,
        latencyMs: Date.now() - startTime,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      });
    } catch (error) {
      return ok({
        connected: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  validateResponseMapping(config: CustomProviderInternalConfig, sampleResponse: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const mapping = config.responseMapping;

    const contentValue = this.extractByPath(sampleResponse, mapping.contentPath);
    if (contentValue === undefined) {
      errors.push(`contentPath "${mapping.contentPath}" not found in sample response`);
    }

    if (mapping.usagePath) {
      const usageValue = this.extractByPath(sampleResponse, mapping.usagePath);
      if (usageValue === undefined) {
        warnings.push(`usagePath "${mapping.usagePath}" not found in sample response`);
      }
    }

    if (mapping.finishReasonPath) {
      const finishValue = this.extractByPath(sampleResponse, mapping.finishReasonPath);
      if (finishValue === undefined) {
        warnings.push(`finishReasonPath "${mapping.finishReasonPath}" not found in sample response`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async performanceTest(config: CustomProviderInternalConfig, iterations: number = 3): Promise<Result<{
    avgLatencyMs: number;
    minLatencyMs: number;
    maxLatencyMs: number;
    successRate: number;
    errors: string[];
  }, Error>> {
    const latencies: number[] = [];
    const testErrors: string[] = [];
    let successes = 0;

    for (let i = 0; i < iterations; i++) {
      const result = await this.testConnectivity(config);
      if (result.ok && result.value.connected) {
        latencies.push(result.value.latencyMs);
        successes++;
      } else {
        testErrors.push(result.ok ? (result.value.error ?? "Unknown error") : result.error.message);
      }
    }

    if (latencies.length === 0) {
      return ok({
        avgLatencyMs: 0,
        minLatencyMs: 0,
        maxLatencyMs: 0,
        successRate: 0,
        errors: testErrors,
      });
    }

    return ok({
      avgLatencyMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      minLatencyMs: Math.min(...latencies),
      maxLatencyMs: Math.max(...latencies),
      successRate: successes / iterations,
      errors: testErrors,
    });
  }

  private injectAuth(headers: Record<string, string>, config: CustomProviderInternalConfig): void {
    const auth = config.authentication;
    switch (auth.type) {
      case "bearer":
        headers[auth.headerName || "Authorization"] = `Bearer ${auth.tokenTemplate}`;
        break;
      case "api_key":
        headers[auth.headerName || "X-API-Key"] = auth.tokenTemplate;
        break;
      case "basic": {
        const encoded = Buffer.from(auth.tokenTemplate).toString("base64");
        headers[auth.headerName || "Authorization"] = `Basic ${encoded}`;
        break;
      }
      case "custom":
        headers[auth.headerName] = auth.tokenTemplate;
        break;
    }
  }

  private extractByPath(data: Record<string, unknown>, path: string): unknown {
    if (!path) return undefined;
    const parts = path.split(".");
    let current: unknown = data;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }
}
