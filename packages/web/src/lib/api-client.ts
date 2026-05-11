const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ApiClientOptions {
  baseUrl?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl || API_BASE_URL;
    this.defaultHeaders = {
      "Content-Type": "application/json",
      ...options.headers,
    };
    this.timeout = options.timeout || 30000;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { headers?: Record<string, string>; timeout?: number }
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeout = options?.timeout || this.timeout;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          ...this.defaultHeaders,
          ...options?.headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        return {
          data: null,
          error: errorText,
          status: response.status,
        };
      }

      const data = await response.json();
      return {
        data,
        error: null,
        status: response.status,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof DOMException && err.name === "AbortError") {
        return { data: null, error: "Request timeout", status: 408 };
      }
      return {
        data: null,
        error: err instanceof Error ? err.message : "Unknown error",
        status: 0,
      };
    }
  }

  async get<T>(path: string, options?: { headers?: Record<string, string> }): Promise<ApiResponse<T>> {
    return this.request<T>("GET", path, undefined, options);
  }

  async post<T>(path: string, body?: unknown, options?: { headers?: Record<string, string> }): Promise<ApiResponse<T>> {
    return this.request<T>("POST", path, body, options);
  }

  async put<T>(path: string, body?: unknown, options?: { headers?: Record<string, string> }): Promise<ApiResponse<T>> {
    return this.request<T>("PUT", path, body, options);
  }

  async patch<T>(path: string, body?: unknown, options?: { headers?: Record<string, string> }): Promise<ApiResponse<T>> {
    return this.request<T>("PATCH", path, body, options);
  }

  async delete<T>(path: string, options?: { headers?: Record<string, string> }): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", path, undefined, options);
  }

  setAuthToken(token: string): void {
    this.defaultHeaders["Authorization"] = `Bearer ${token}`;
  }

  clearAuthToken(): void {
    delete this.defaultHeaders["Authorization"];
  }

  setHeader(key: string, value: string): void {
    this.defaultHeaders[key] = value;
  }

  removeHeader(key: string): void {
    delete this.defaultHeaders[key];
  }
}

export const apiClient = new ApiClient();

export { ApiClient };
export type { ApiResponse, ApiClientOptions };
