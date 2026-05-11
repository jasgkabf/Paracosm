import type { Tool, ToolParameter } from "@paracosm/shared";
import type { ToolInternal } from "../types.js";
import { ToolType, generateId } from "@paracosm/shared";
import { ToolRegistry } from "../tool-registry.js";
import type { MCPClient, MCPTool, MCPToolResult } from "./mcp-client.js";

export interface ToolSchema {
  type: "object";
  properties: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
    default?: unknown;
  }>;
  required: string[];
}

export class MCPAdapter {
  private registry: ToolRegistry;

  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }

  adaptTool(mcpTool: MCPTool): ToolInternal {
    const adapted: ToolInternal = {
      id: mcpTool.name,
      name: mcpTool.name,
      type: ToolType.MCP,
      description: mcpTool.description ?? "",
      parameters: this.convertParameters(mcpTool.inputSchema ?? undefined),
      returnType: "unknown",
      returnDescription: `Result from MCP tool: ${mcpTool.name}`,
      version: "1.0.0",
      deprecated: false,
      deprecationMessage: null,
      examples: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dependencies: [],
      category: "network",
      permissionLevel: "caution" as const,
      rateLimitPerMinute: 60,
      maxConcurrentExecutions: 5,
      requiresSandbox: false,
      execute: async (params, context) => {
        return {
          executionId: generateId(),
          toolId: mcpTool.name,
          success: true,
          data: params,
          error: null,
          executionTimeMs: 0,
          memoryUsedBytes: 0,
          cpuTimeMs: 0,
          retries: 0,
          timestamp: new Date().toISOString(),
        };
      },
      validate: (params) => {
        if (!mcpTool.inputSchema) return true;
        const required = mcpTool.inputSchema.required ?? [];
        for (const field of required) {
          if (!(field in params) || params[field] === undefined || params[field] === null) {
            return false;
          }
        }
        return true;
      },
    };
    return adapted;
  }

  convertSchema(mcpSchema: { type?: string; properties?: Record<string, unknown>; required?: string[] }): ToolSchema {
    const properties: ToolSchema["properties"] = {};
    if (mcpSchema.properties) {
      for (const [key, value] of Object.entries(mcpSchema.properties)) {
        const prop = value as Record<string, unknown>;
        properties[key] = {
          type: this.mapJsonSchemaType(String(prop.type ?? "string")),
          description: typeof prop.description === "string" ? prop.description : undefined,
          enum: Array.isArray(prop.enum) ? prop.enum.map(String) : undefined,
          default: prop.default,
        };
      }
    }
    return {
      type: "object",
      properties,
      required: mcpSchema.required ?? [],
    };
  }

  bridge(mcpClient: MCPClient, registry: ToolRegistry): void {
    const tools = mcpClient.listTools();
    for (const mcpTool of tools) {
      const adapted = this.adaptTool(mcpTool);
      try {
        if (!registry.has(adapted.id)) {
          registry.register(adapted);
        }
      } catch {
        // tool may already be registered
      }
    }
  }

  private convertParameters(schema?: { type?: string; properties?: Record<string, unknown>; required?: string[] }): ToolParameter[] {
    if (!schema || !schema.properties) {
      return [];
    }
    const parameters: ToolParameter[] = [];
    const required = new Set(schema.required ?? []);
    for (const [name, value] of Object.entries(schema.properties)) {
      const prop = value as Record<string, unknown>;
      parameters.push({
        name,
        type: this.mapJsonSchemaType(String(prop.type ?? "string")) as ToolParameter["type"],
        description: typeof prop.description === "string" ? prop.description : "",
        required: required.has(name),
        defaultValue: prop.default ?? null,
        enum: Array.isArray(prop.enum) ? prop.enum.map(String) : null,
      });
    }
    return parameters;
  }

  private mapJsonSchemaType(jsonSchemaType: string): string {
    switch (jsonSchemaType) {
      case "string":
        return "string";
      case "number":
      case "integer":
        return "number";
      case "boolean":
        return "boolean";
      case "object":
        return "object";
      case "array":
        return "array";
      default:
        return "string";
    }
  }
}
