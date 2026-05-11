import { cpus, totalmem, freemem, hostname, type, arch, platform, release, uptime, loadavg, networkInterfaces } from "node:os";
import { statfs } from "node:fs/promises";
import { exec } from "node:child_process";
import type {
  ToolInternal,
  ToolExecutionContext,
  ToolExecutionResult,
} from "../types.js";
import { ToolType, generateId } from "@paracosm/shared";

export interface CpuInfo {
  model: string;
  speedMhz: number;
  cores: number;
  usagePercent: number;
  loadAvg: number[];
}

export interface MemoryInfo {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usagePercent: number;
}

export interface DiskInfo {
  filesystem: string;
  mountPoint: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usagePercent: number;
}

export interface NetworkInfo {
  hostname: string;
  interfaces: Array<{
    name: string;
    address: string;
    family: string;
    internal: boolean;
  }>;
}

export interface OsInfo {
  type: string;
  platform: string;
  arch: string;
  release: string;
  hostname: string;
  uptimeSeconds: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpuPercent: number;
  memoryBytes: number;
  status: string;
}

export class SystemInfoTool implements ToolInternal {
  id = "system_info";
  name = "System Info";
  type = ToolType.Analyzer;
  description = "Gather system information including CPU, memory, disk, network, OS, and processes";
  parameters = [
    { name: "category", type: "string" as const, description: "Information category to retrieve", required: true, defaultValue: null, enum: ["cpu", "memory", "disk", "network", "os", "processes"] },
  ];
  returnType = "unknown";
  returnDescription = "System information based on the requested category";
  version = "1.0.0";
  deprecated = false;
  deprecationMessage = null;
  examples = [
    { input: { category: "cpu" }, output: { cores: 8, usagePercent: 45.2 }, description: "Get CPU information" },
  ];
  createdAt = new Date().toISOString();
  updatedAt = new Date().toISOString();
  dependencies: string[] = [];
  category = "system";
  permissionLevel = "safe" as const;
  rateLimitPerMinute = 120;
  maxConcurrentExecutions = 20;
  requiresSandbox = false;

  async execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    try {
      const category = String(params.category ?? "");
      if (!category) {
        return this.errorResult("Category is required", startTime);
      }
      let result: unknown;
      switch (category) {
        case "cpu":
          result = this.cpu();
          break;
        case "memory":
          result = this.memory();
          break;
        case "disk":
          result = await this.disk();
          break;
        case "network":
          result = this.network();
          break;
        case "os":
          result = this.os();
          break;
        case "processes":
          result = await this.processes();
          break;
        default:
          return this.errorResult(`Unknown category: ${category}`, startTime);
      }
      return this.successResult(result, startTime);
    } catch (error) {
      return this.errorResult(
        error instanceof Error ? error.message : String(error),
        startTime
      );
    }
  }

  validate(params: Record<string, unknown>): boolean {
    if (!params.category || typeof params.category !== "string") return false;
    const validCategories = ["cpu", "memory", "disk", "network", "os", "processes"];
    return validCategories.includes(params.category as string);
  }

  cpu(): CpuInfo {
    const cpuList = cpus();
    const firstCpu = cpuList[0];
    let totalIdle = 0;
    let totalTick = 0;
    for (const cpu of cpuList) {
      for (const type of Object.keys(cpu.times) as Array<keyof typeof cpu.times>) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }
    const usagePercent = totalTick > 0 ? ((totalTick - totalIdle) / totalTick) * 100 : 0;
    return {
      model: firstCpu?.model ?? "unknown",
      speedMhz: firstCpu?.speed ?? 0,
      cores: cpuList.length,
      usagePercent: Math.round(usagePercent * 100) / 100,
      loadAvg: loadavg(),
    };
  }

  memory(): MemoryInfo {
    const total = totalmem();
    const free = freemem();
    const used = total - free;
    return {
      totalBytes: total,
      freeBytes: free,
      usedBytes: used,
      usagePercent: Math.round((used / total) * 10000) / 100,
    };
  }

  async disk(): Promise<DiskInfo> {
    try {
      const stats = await statfs("/");
      const totalBytes = stats.blocks * stats.bsize;
      const freeBytes = stats.bfree * stats.bsize;
      const usedBytes = totalBytes - freeBytes;
      return {
        filesystem: "/",
        mountPoint: "/",
        totalBytes,
        freeBytes,
        usedBytes,
        usagePercent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 10000) / 100 : 0,
      };
    } catch {
      return {
        filesystem: "/",
        mountPoint: "/",
        totalBytes: 0,
        freeBytes: 0,
        usedBytes: 0,
        usagePercent: 0,
      };
    }
  }

  network(): NetworkInfo {
    const interfaces: NetworkInfo["interfaces"] = [];
    try {
      const ni = networkInterfaces();
      if (ni) {
        for (const [name, addrs] of Object.entries(ni)) {
          if (addrs) {
            for (const addr of addrs) {
              interfaces.push({
                name,
                address: addr.address,
                family: addr.family,
                internal: addr.internal,
              });
            }
          }
        }
      }
    } catch {
      // networkInterfaces not available
    }
    return {
      hostname: hostname(),
      interfaces,
    };
  }

  os(): OsInfo {
    return {
      type: type(),
      platform: platform(),
      arch: arch(),
      release: release(),
      hostname: hostname(),
      uptimeSeconds: Math.floor(uptime()),
    };
  }

  async processes(): Promise<ProcessInfo[]> {
    return new Promise((resolve) => {
      const cmd = platform() === "win32" ? "tasklist /FO CSV /NH" : "ps -eo pid,comm,%cpu,rss,stat --no-headers";
      exec(cmd, { timeout: 5000 }, (error, stdout) => {
        if (error) {
          resolve([]);
          return;
        }
        const processes: ProcessInfo[] = [];
        const lines = stdout.trim().split("\n");
        for (const line of lines) {
          try {
            if (platform() === "win32") {
              const parts = line.split('","').map((p) => p.replace(/"/g, "").trim());
              if (parts.length >= 2) {
                processes.push({
                  pid: parseInt(parts[1], 10) || 0,
                  name: parts[0],
                  cpuPercent: 0,
                  memoryBytes: parseInt(parts[4]?.replace(/[^\d]/g, ""), 10) || 0,
                  status: "running",
                });
              }
            } else {
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 5) {
                processes.push({
                  pid: parseInt(parts[0], 10) || 0,
                  name: parts[1],
                  cpuPercent: parseFloat(parts[2]) || 0,
                  memoryBytes: (parseFloat(parts[3]) || 0) * 1024,
                  status: parts[4],
                });
              }
            }
          } catch {
            continue;
          }
        }
        resolve(processes.slice(0, 100));
      });
    });
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
