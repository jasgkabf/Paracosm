import os from 'node:os';
import { execSync } from 'node:child_process';
import type { ToolResult } from '@paracosm/shared';
import { TOOL_SYSTEM_INFO, DEFAULT_TOOL_CONFIG } from '@paracosm/shared';
import type { ToolDefinition, ToolExecutionContext } from '../types.js';

export class SystemInfoTool {
  static readonly definition: ToolDefinition = {
    id: TOOL_SYSTEM_INFO,
    name: 'System Info',
    type: 'computation',
    description: 'Get system information including OS, CPU, memory, disk, and uptime',
    version: '1.0.0',
    config: { ...DEFAULT_TOOL_CONFIG },
    permissions: [{ resource: 'system', actions: ['read'], constraints: {} }],
    handler: async (input: unknown, _context: ToolExecutionContext): Promise<ToolResult> => {
      const startTime = Date.now();
      const data = input as { infoType?: string };
      const infoType = data.infoType ?? 'general';

      try {
        let info: Record<string, unknown>;

        switch (infoType) {
          case 'cpu':
            info = {
              model: os.cpus()[0]?.model ?? 'unknown',
              cores: os.cpus().length,
              architecture: os.arch(),
              loadAvg: os.loadavg(),
            };
            break;

          case 'memory': {
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            info = {
              totalGB: (totalMem / (1024 ** 3)).toFixed(2),
              freeGB: (freeMem / (1024 ** 3)).toFixed(2),
              usedGB: ((totalMem - freeMem) / (1024 ** 3)).toFixed(2),
              usagePercent: (((totalMem - freeMem) / totalMem) * 100).toFixed(1),
              processMemoryMB: (process.memoryUsage().heapUsed / (1024 ** 2)).toFixed(2),
            };
            break;
          }

          case 'disk': {
            let diskInfo: Record<string, unknown> = {};
            try {
              const output = execSync('df -h / 2>/dev/null || echo "unavailable"', { encoding: 'utf-8', timeout: 5000 });
              diskInfo = { raw: output.trim() };
            } catch {
              diskInfo = { raw: 'unavailable' };
            }
            info = diskInfo;
            break;
          }

          case 'network': {
            const interfaces = os.networkInterfaces();
            const networkList: Array<{ name: string; address: string; family: string }> = [];
            for (const [name, addrs] of Object.entries(interfaces)) {
              if (!addrs) continue;
              for (const addr of addrs) {
                networkList.push({ name, address: addr.address, family: addr.family });
              }
            }
            info = { interfaces: networkList, hostname: os.hostname() };
            break;
          }

          case 'general':
          default:
            info = {
              platform: os.platform(),
              arch: os.arch(),
              release: os.release(),
              hostname: os.hostname(),
              nodeVersion: process.version,
              cpuModel: os.cpus()[0]?.model ?? 'unknown',
              cpuCores: os.cpus().length,
              totalMemoryGB: (os.totalmem() / (1024 ** 3)).toFixed(2),
              freeMemoryGB: (os.freemem() / (1024 ** 3)).toFixed(2),
              uptimeSeconds: Math.floor(os.uptime()),
              processUptimeSeconds: Math.floor(process.uptime()),
              loadAvg: os.loadavg(),
            };
            break;
        }

        return {
          toolId: TOOL_SYSTEM_INFO,
          success: true,
          output: { infoType, info },
          duration: Date.now() - startTime,
          metadata: {},
          timestamp: new Date(),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          toolId: TOOL_SYSTEM_INFO,
          success: false,
          output: null,
          error: `Failed to get system info: ${message}`,
          duration: Date.now() - startTime,
          metadata: {},
          timestamp: new Date(),
        };
      }
    },
    validate: (_input: unknown): string[] => {
      return [];
    },
  };
}
