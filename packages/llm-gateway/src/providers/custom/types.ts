export interface CustomProviderInternalConfig {
  providerId: string;
  name: string;
  description: string;
  baseUrl: string;
  authentication: {
    type: "bearer" | "api_key" | "basic" | "custom";
    headerName: string;
    tokenTemplate: string;
  };
  requestMapping: RequestMappingInternal;
  responseMapping: ResponseMappingInternal;
  streamConfig: StreamConfigInternal;
  healthCheckEndpoint: string | null;
  rateLimitRpm: number;
  timeoutMs: number;
}

export interface RequestMappingInternal {
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "PATCH";
  headers: Record<string, string>;
  bodyTemplate: Record<string, unknown>;
  messagePath: string;
  modelPath: string;
  temperaturePath: string;
  maxTokensPath: string;
  streamPathParam: string;
  customPaths: Record<string, JSONPathMappingInternal>;
}

export interface ResponseMappingInternal {
  contentPath: string;
  usagePath: string | null;
  promptTokensPath: string | null;
  completionTokensPath: string | null;
  totalTokensPath: string | null;
  finishReasonPath: string | null;
  functionCallPath: string | null;
  functionCallNamePath: string | null;
  functionCallArgumentsPath: string | null;
  errorPath: string;
  errorMessagePath: string;
  errorCodePath: string | null;
  customPaths: Record<string, JSONPathMappingInternal>;
}

export interface StreamConfigInternal {
  enabled: boolean;
  streamEndpoint: string | null;
  streamFormat: "sse" | "websocket" | "ndjson";
  chunkContentPath: string;
  chunkFinishPath: string | null;
  chunkUsagePath: string | null;
  delimiter: string;
  heartbeatIntervalMs: number;
}

export interface JSONPathMappingInternal {
  path: string;
  defaultValue: unknown;
  required: boolean;
  transform: string | null;
}

export interface ProviderTemplateInternal {
  id: string;
  name: string;
  description: string;
  provider: string;
  defaultConfig: CustomProviderInternalConfig;
  capabilities: { name: string; supported: boolean; details: Record<string, unknown>; limitations: string[] }[];
  version: string;
  author: string;
}
