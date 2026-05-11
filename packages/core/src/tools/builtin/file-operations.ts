import fs from 'node:fs';
import path from 'node:path';
import type { ToolResult } from '@paracosm/shared';
import { TOOL_FILE_OPERATIONS, DEFAULT_TOOL_CONFIG } from '@paracosm/shared';
import type { ToolDefinition, ToolExecutionContext } from '../types.js';

export class FileOperationsTool {
  static readonly definition: ToolDefinition = {
    id: TOOL_FILE_OPERATIONS,
    name: 'File Operations',
    type: 'file_operation',
    description: 'Read, write, list, and manage files and directories. Operations: list, read, write, exists, stat',
    version: '1.0.0',
    config: { ...DEFAULT_TOOL_CONFIG },
    permissions: [
      { resource: 'filesystem', actions: ['read', 'write'], constraints: { sandboxed: true } },
    ],
    handler: async (input: unknown, _context: ToolExecutionContext): Promise<ToolResult> => {
      const startTime = Date.now();
      const data = input as { operation?: string; path?: string; content?: string };
      const operation = data.operation ?? 'read';
      const filePath = data.path ?? '';

      try {
        switch (operation) {
          case 'list': {
            const entries = fs.readdirSync(filePath, { withFileTypes: true });
            const items = entries.map((entry) => ({
              name: entry.name,
              type: entry.isDirectory() ? 'directory' : 'file',
            }));
            return {
              toolId: TOOL_FILE_OPERATIONS,
              success: true,
              output: { path: filePath, items, count: items.length },
              duration: Date.now() - startTime,
              metadata: {},
              timestamp: new Date(),
            };
          }

          case 'read': {
            const content = fs.readFileSync(filePath, 'utf-8');
            return {
              toolId: TOOL_FILE_OPERATIONS,
              success: true,
              output: { path: filePath, content },
              duration: Date.now() - startTime,
              metadata: {},
              timestamp: new Date(),
            };
          }

          case 'write': {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, data.content ?? '', 'utf-8');
            return {
              toolId: TOOL_FILE_OPERATIONS,
              success: true,
              output: { path: filePath, bytesWritten: (data.content ?? '').length },
              duration: Date.now() - startTime,
              metadata: {},
              timestamp: new Date(),
            };
          }

          case 'exists': {
            const exists = fs.existsSync(filePath);
            return {
              toolId: TOOL_FILE_OPERATIONS,
              success: true,
              output: { path: filePath, exists },
              duration: Date.now() - startTime,
              metadata: {},
              timestamp: new Date(),
            };
          }

          case 'stat': {
            const stat = fs.statSync(filePath);
            return {
              toolId: TOOL_FILE_OPERATIONS,
              success: true,
              output: {
                path: filePath,
                isFile: stat.isFile(),
                isDirectory: stat.isDirectory(),
                size: stat.size,
                createdAt: stat.birthtime.toISOString(),
                modifiedAt: stat.mtime.toISOString(),
                permissions: stat.mode.toString(8).slice(-3),
              },
              duration: Date.now() - startTime,
              metadata: {},
              timestamp: new Date(),
            };
          }

          default:
            return {
              toolId: TOOL_FILE_OPERATIONS,
              success: false,
              output: null,
              error: `Unknown operation: ${operation}. Supported: list, read, write, exists, stat`,
              duration: Date.now() - startTime,
              metadata: {},
              timestamp: new Date(),
            };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          toolId: TOOL_FILE_OPERATIONS,
          success: false,
          output: null,
          error: `File operation '${operation}' failed: ${message}`,
          duration: Date.now() - startTime,
          metadata: {},
          timestamp: new Date(),
        };
      }
    },
    validate: (input: unknown): string[] => {
      const errors: string[] = [];
      if (!input || typeof input !== 'object') { errors.push('Input must be an object'); return errors; }
      const data = input as Record<string, unknown>;
      if (!data.operation) errors.push('operation is required');
      if (!data.path) errors.push('path is required');
      const validOps = ['list', 'read', 'write', 'exists', 'stat'];
      if (data.operation && !validOps.includes(data.operation as string)) {
        errors.push(`operation must be one of: ${validOps.join(', ')}`);
      }
      return errors;
    },
  };
}
