import type {
  ToolInternal,
  ToolExecutionContext,
  ToolExecutionResult,
} from "../types.js";
import { ToolType, generateId } from "@paracosm/shared";

export interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  executionTimeMs: number;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
  validateStatus?: (status: number) => boolean;
  responseType?: "json" | "text" | "buffer";
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export class ApiCallerTool implements ToolInternal {
  id = "api_caller";
  name = "API Caller";
  type = ToolType.ApiClient;
  description = "Make HTTP API calls with support for REST and GraphQL endpoints with auth handling";
  parameters = [
    { name: "method", type: "string" as const, description: "HTTP method", required: true, defaultValue: null, enum: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] },
    { name: "url", type: "string" as const, description: "Request URL", required: true, defaultValue: null, enum: null },
    { name: "body", type: "object" as const, description: "Request body for POST/PUT/PATCH", required: false, defaultValue: null, enum: null },
    { name: "headers", type: "object" as const, description: "Request headers", required: false, defaultValue: null, enum: null },
  ];
  returnType = "ApiResponse";
  returnDescription = "HTTP response with status, headers, and body";
  version = "1.0.0";
  deprecated = false;
  deprecationMessage = null;
  examples = [
    { input: { method: "GET", url: "https://api.example.com/data" }, output: { status: 200, body: {} }, description: "Make a GET request" },
  ];
  createdAt = new Date().toISOString();
  updatedAt = new Date().toISOString();
  dependencies: string[] = [];
  category = "network";
  permissionLevel = "caution" as const;
  rateLimitPerMinute = 60;
  maxConcurrentExecutions = 10;
  requiresSandbox = false;

  private authTokens: Map<string, string> = new Map();
  private defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  private requestTimeout: number = 30000;
  private maxRedirects: number = 5;
  private baseUrl: string | null = null;

  async execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    try {
      const method = String(params.method ?? "").toUpperCase() as HttpMethod;
      const url = String(params.url ?? "");
      if (!method) {
        return this.errorResult("HTTP method is required", startTime);
      }
      if (!url) {
        return this.errorResult("URL is required", startTime);
      }
      const options: RequestOptions = {
        headers: (params.headers as Record<string, string>) ?? {},
        timeout: Number(params.timeout ?? this.requestTimeout),
        followRedirects: params.followRedirects !== false,
        maxRedirects: Number(params.maxRedirects ?? this.maxRedirects),
        responseType: (params.responseType as RequestOptions["responseType"]) ?? "json",
      };
      let response: ApiResponse;
      switch (method) {
        case "GET":
          response = await this.get(url, options);
          break;
        case "POST":
          response = await this.post(url, params.body, options);
          break;
        case "PUT":
          response = await this.put(url, params.body, options);
          break;
        case "DELETE":
          response = await this.delete(url, options);
          break;
        case "PATCH": {
          const resolvedUrl = this.resolveUrl(url);
          response = await this.makeRequest("PATCH", resolvedUrl, params.body, options);
          break;
        }
        case "HEAD": {
          const resolvedUrl = this.resolveUrl(url);
          response = await this.makeRequest("HEAD", resolvedUrl, null, options);
          break;
        }
        case "OPTIONS": {
          const resolvedUrl = this.resolveUrl(url);
          response = await this.makeRequest("OPTIONS", resolvedUrl, null, options);
          break;
        }
        default:
          return this.errorResult(`Unsupported HTTP method: ${method}`, startTime);
      }
      return this.successResult(response, startTime);
    } catch (error) {
      return this.errorResult(
        error instanceof Error ? error.message : String(error),
        startTime
      );
    }
  }

  validate(params: Record<string, unknown>): boolean {
    if (!params.method || typeof params.method !== "string") return false;
    const validMethods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
    if (!validMethods.includes((params.method as string).toUpperCase())) return false;
    if (!params.url || typeof params.url !== "string") return false;
    try {
      new URL(params.url as string);
    } catch {
      return false;
    }
    return true;
  }

  async get(url: string, options?: RequestOptions): Promise<ApiResponse> {
    const resolvedUrl = this.resolveUrl(url);
    return this.makeRequest("GET", resolvedUrl, null, options);
  }

  async post(url: string, body: unknown, options?: RequestOptions): Promise<ApiResponse> {
    const resolvedUrl = this.resolveUrl(url);
    return this.makeRequest("POST", resolvedUrl, body, options);
  }

  async put(url: string, body: unknown, options?: RequestOptions): Promise<ApiResponse> {
    const resolvedUrl = this.resolveUrl(url);
    return this.makeRequest("PUT", resolvedUrl, body, options);
  }

  async delete(url: string, options?: RequestOptions): Promise<ApiResponse> {
    const resolvedUrl = this.resolveUrl(url);
    return this.makeRequest("DELETE", resolvedUrl, null, options);
  }

  async graphql(url: string, query: string, variables?: Record<string, unknown>): Promise<ApiResponse> {
    const resolvedUrl = this.resolveUrl(url);
    const body = {
      query,
      variables: variables ?? {},
    };
    const options: RequestOptions = {
      headers: { "Content-Type": "application/json" },
      timeout: this.requestTimeout,
    };
    return this.makeRequest("POST", resolvedUrl, body, options);
  }

  setAuthToken(key: string, token: string): void {
    this.authTokens.set(key, token);
  }

  removeAuthToken(key: string): void {
    this.authTokens.delete(key);
  }

  setDefaultHeader(key: string, value: string): void {
    this.defaultHeaders[key] = value;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  setTimeout(ms: number): void {
    this.requestTimeout = ms;
  }

  private resolveUrl(url: string): string {
    if (this.baseUrl && !url.startsWith("http://") && !url.startsWith("https://")) {
      return `${this.baseUrl.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
    }
    return url;
  }

  private async makeRequest(
    method: HttpMethod,
    url: string,
    body: unknown,
    options?: RequestOptions
  ): Promise<ApiResponse> {
    const startTime = Date.now();
    const mergedHeaders: Record<string, string> = {
      ...this.defaultHeaders,
      ...(options?.headers ?? {}),
    };
    for (const [key, token] of this.authTokens.entries()) {
      if (key === "bearer" || key === "Authorization") {
        mergedHeaders["Authorization"] = `Bearer ${token}`;
      } else if (key === "basic") {
        mergedHeaders["Authorization"] = `Basic ${token}`;
      } else if (key.toLowerCase().endsWith("-api-key")) {
        mergedHeaders[key] = token;
      }
    }
    try {
      const parsedUrl = new URL(url);
      const fetchOptions: RequestInit = {
        method,
        headers: mergedHeaders,
      };
      if (body && method !== "GET" && method !== "HEAD") {
        fetchOptions.body = JSON.stringify(body);
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        options?.timeout ?? this.requestTimeout
      );
      fetchOptions.signal = controller.signal;
      let response: Response;
      try {
        response = await fetch(url, fetchOptions);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        return {
          status: 0,
          statusText: "Network Error",
          headers: {},
          body: { error: fetchError instanceof Error ? fetchError.message : String(fetchError) },
          executionTimeMs: Date.now() - startTime,
        };
      }
      clearTimeout(timeoutId);
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      let responseBody: unknown;
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        try {
          responseBody = await response.json();
        } catch {
          responseBody = await response.text();
        }
      } else {
        responseBody = await response.text();
      }
      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 0,
        statusText: "Error",
        headers: {},
        body: { error: error instanceof Error ? error.message : String(error) },
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private successResult(data: unknown, startTime: number): ToolExecutionResult {
    return {
      executionId: generateId(),
      toolId: this.id,
      success: true,
      data,
      error: null,
      executionTimeMs: Date.now() - startTime,
      memoryUsedBytes: 0,
      cpuTimeMs: Date.now() - startTime,
      retries: 0,
      timestamp: new Date().toISOString(),
    };
  }

  private errorResult(error: string, startTime: number): ToolExecutionResult {
    return {
      executionId: generateId(),
      toolId: this.id,
      success: false,
      data: null,
      error,
      executionTimeMs: Date.now() - startTime,
      memoryUsedBytes: 0,
      cpuTimeMs: Date.now() - startTime,
      retries: 0,
      timestamp: new Date().toISOString(),
    };
  }
}
