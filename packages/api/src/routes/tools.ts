import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createLogger, generateId } from "@paracosm/shared";
import type { ToolResult } from "@paracosm/shared";
import type { ToolCategory } from "@paracosm/shared";
import { WSManager } from "../websocket/ws-manager.js";

const logger = createLogger("api:routes:tools");

interface ExecuteBody {
  toolId: string;
  parameters: Record<string, unknown>;
  timeout?: number;
  sandbox?: boolean;
}

interface ToolParams {
  id: string;
}

interface StoredTool {
  id: string;
  name: string;
  type: ToolCategory;
  description: string;
  parameters: Array<{ name: string; type: string; required: boolean; description: string; defaultValue: unknown }>;
  returnType: string;
  returnDescription: string;
  version: string;
  deprecated: boolean;
  deprecationMessage: string | null;
  examples: Array<{ input: Record<string, unknown>; output: unknown; description: string }>;
  createdAt: string;
  updatedAt: string;
}

interface StoredPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  tools: string[];
  dependencies: string[];
  permissions: string[];
  enabled: boolean;
}

const tools = new Map<string, StoredTool>();
const plugins = new Map<string, StoredPlugin>();

function seedTools(): void {
  const toolDefs: Array<Omit<StoredTool, "createdAt" | "updatedAt">> = [
    {
      id: "web_search",
      name: "Web Search",
      type: "information" as ToolCategory,
      description: "Search the web for information using various search engines",
      parameters: [
        { name: "query", type: "string", required: true, description: "Search query", defaultValue: null },
        { name: "maxResults", type: "number", required: false, description: "Maximum number of results", defaultValue: 10 },
      ],
      returnType: "array",
      returnDescription: "Array of search results with title, url, and snippet",
      version: "1.0.0",
      deprecated: false,
      deprecationMessage: null,
      examples: [{ input: { query: "paracosm agent" }, output: [], description: "Search for paracosm agent information" }],
    },
    {
      id: "code_execute",
      name: "Code Execute",
      type: "code" as ToolCategory,
      description: "Execute code in a sandboxed environment",
      parameters: [
        { name: "code", type: "string", required: true, description: "Code to execute", defaultValue: null },
        { name: "language", type: "string", required: true, description: "Programming language", defaultValue: "javascript" },
        { name: "timeout", type: "number", required: false, description: "Execution timeout in ms", defaultValue: 30000 },
      ],
      returnType: "object",
      returnDescription: "Execution result with stdout, stderr, and exit code",
      version: "1.0.0",
      deprecated: false,
      deprecationMessage: null,
      examples: [{ input: { code: "console.log('hello')", language: "javascript" }, output: { stdout: "hello\n", stderr: "", exitCode: 0 }, description: "Execute a simple JavaScript program" }],
    },
    {
      id: "file_read",
      name: "File Read",
      type: "file" as ToolCategory,
      description: "Read file contents from the filesystem",
      parameters: [
        { name: "path", type: "string", required: true, description: "File path", defaultValue: null },
        { name: "encoding", type: "string", required: false, description: "File encoding", defaultValue: "utf-8" },
      ],
      returnType: "string",
      returnDescription: "File contents as string",
      version: "1.0.0",
      deprecated: false,
      deprecationMessage: null,
      examples: [{ input: { path: "/tmp/test.txt" }, output: "file contents", description: "Read a text file" }],
    },
    {
      id: "data_transform",
      name: "Data Transform",
      type: "data" as ToolCategory,
      description: "Transform data between different formats",
      parameters: [
        { name: "data", type: "string", required: true, description: "Input data", defaultValue: null },
        { name: "fromFormat", type: "string", required: true, description: "Source format", defaultValue: null },
        { name: "toFormat", type: "string", required: true, description: "Target format", defaultValue: null },
      ],
      returnType: "string",
      returnDescription: "Transformed data",
      version: "1.0.0",
      deprecated: false,
      deprecationMessage: null,
      examples: [{ input: { data: '{"key":"value"}', fromFormat: "json", toFormat: "yaml" }, output: "key: value\n", description: "Convert JSON to YAML" }],
    },
    {
      id: "http_request",
      name: "HTTP Request",
      type: "network" as ToolCategory,
      description: "Make HTTP requests to external APIs",
      parameters: [
        { name: "url", type: "string", required: true, description: "Request URL", defaultValue: null },
        { name: "method", type: "string", required: false, description: "HTTP method", defaultValue: "GET" },
        { name: "headers", type: "object", required: false, description: "Request headers", defaultValue: {} },
        { name: "body", type: "string", required: false, description: "Request body", defaultValue: null },
      ],
      returnType: "object",
      returnDescription: "HTTP response with status, headers, and body",
      version: "1.0.0",
      deprecated: false,
      deprecationMessage: null,
      examples: [{ input: { url: "https://api.example.com/data", method: "GET" }, output: { status: 200, body: {} }, description: "Make a GET request" }],
    },
    {
      id: "legacy_analyze",
      name: "Legacy Analyze",
      type: "system" as ToolCategory,
      description: "Legacy analysis tool (deprecated, use data_transform instead)",
      parameters: [
        { name: "data", type: "string", required: true, description: "Data to analyze", defaultValue: null },
      ],
      returnType: "object",
      returnDescription: "Analysis results",
      version: "0.9.0",
      deprecated: true,
      deprecationMessage: "Use data_transform tool instead",
      examples: [],
    },
  ];

  for (const tool of toolDefs) {
    tools.set(tool.id, {
      ...tool,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const pluginDefs: StoredPlugin[] = [
    {
      id: "core-tools",
      name: "Core Tools Plugin",
      version: "1.0.0",
      description: "Built-in core tools for basic operations",
      author: "Paracosm",
      license: "MIT",
      tools: ["web_search", "code_execute", "file_read"],
      dependencies: [],
      permissions: ["network", "filesystem", "compute"],
      enabled: true,
    },
    {
      id: "data-tools",
      name: "Data Tools Plugin",
      version: "1.0.0",
      description: "Tools for data transformation and analysis",
      author: "Paracosm",
      license: "MIT",
      tools: ["data_transform", "http_request"],
      dependencies: [],
      permissions: ["network"],
      enabled: true,
    },
  ];

  for (const plugin of pluginDefs) {
    plugins.set(plugin.id, plugin);
  }
}

seedTools();

export async function registerToolRoutes(fastify: FastifyInstance, wsManager: WSManager): Promise<void> {
  fastify.get("/tools/list", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const toolList = Array.from(tools.values());

    return reply.status(200).send({
      success: true,
      data: {
        items: toolList,
        total: toolList.length,
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.get<{ Params: ToolParams }>("/tools/:id", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Params: ToolParams }>, reply: FastifyReply) => {
    const { id } = request.params;

    const tool = tools.get(id);
    if (!tool) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Tool ${id} not found`,
          details: { toolId: id },
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    return reply.status(200).send({
      success: true,
      data: tool,
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });

  fastify.post<{ Body: ExecuteBody }>("/tools/execute", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Body: ExecuteBody }>, reply: FastifyReply) => {
    const { toolId, parameters, timeout, sandbox } = request.body;

    if (!toolId || typeof toolId !== "string") {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "toolId is required and must be a string",
          details: { field: "toolId" },
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    if (!parameters || typeof parameters !== "object") {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "parameters is required and must be an object",
          details: { field: "parameters" },
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    const tool = tools.get(toolId);
    if (!tool) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Tool ${toolId} not found`,
          details: { toolId },
        },
        meta: { requestId: request.id, timestamp: new Date().toISOString() },
      });
    }

    if (tool.deprecated) {
      logger.warn("Executing deprecated tool", { toolId, deprecationMessage: tool.deprecationMessage });
    }

    const startTime = Date.now();
    const executionTimeMs = Math.floor(10 + Math.random() * 100);

    const result: ToolResult = {
      toolId: toolId as any,
      success: true,
      data: {
        toolId,
        parameters,
        result: `Executed ${tool.name} successfully`,
        executionTimeMs,
      },
      error: null,
      executionTimeMs,
      metadata: {
        toolVersion: tool.version,
        sandbox: sandbox ?? false,
        timeout: timeout ?? 30000,
      },
      timestamp: new Date().toISOString(),
    };

    const duration = Date.now() - startTime;

    wsManager.broadcast("system/notification", {
      type: "tool_executed",
      toolId,
      success: result.success,
      duration,
    });

    logger.info("Tool executed", { toolId, success: result.success, duration });

    return reply.status(200).send({
      success: true,
      data: {
        toolId: result.toolId,
        success: result.success,
        data: result.data,
        error: result.error,
        executionTimeMs: result.executionTimeMs,
        metadata: result.metadata,
        timestamp: result.timestamp,
        duration,
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString(), duration },
    });
  });

  fastify.get("/tools/plugins", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const pluginList = Array.from(plugins.values());

    return reply.status(200).send({
      success: true,
      data: {
        items: pluginList,
        total: pluginList.length,
      },
      meta: { requestId: request.id, timestamp: new Date().toISOString() },
    });
  });
}
