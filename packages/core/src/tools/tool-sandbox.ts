import type {
  SandboxConfig,
  SandboxStats,
  ToolExecutionContext,
} from "./types.js";
import { generateId } from "@paracosm/shared";

export interface Sandbox {
  id: string;
  config: SandboxConfig;
  createdAt: number;
  isActive: boolean;
  stats: SandboxStats;
}

interface ResourceTracker {
  memoryUsed: number;
  cpuTimeMs: number;
  executionTimeMs: number;
  fileOperations: number;
  networkRequests: number;
  subprocessCount: number;
  startTime: number;
}

export class ToolSandbox {
  private sandboxes: Map<string, Sandbox> = new Map();
  private resourceTrackers: Map<string, ResourceTracker> = new Map();
  private globalBlockedModules: Set<string> = new Set([
    "child_process",
    "cluster",
    "dgram",
    "dns",
    "fs",
    "http",
    "https",
    "net",
    "os",
    "readline",
    "repl",
    "tls",
    "vm",
  ]);

  create(config: SandboxConfig): Sandbox {
    const id = generateId();
    const now = Date.now();
    const sandbox: Sandbox = {
      id,
      config,
      createdAt: now,
      isActive: true,
      stats: {
        sandboxId: id,
        memoryUsedBytes: 0,
        cpuTimeMs: 0,
        executionTimeMs: 0,
        fileOperations: 0,
        networkRequests: 0,
        subprocessCount: 0,
        isOverLimit: false,
      },
    };
    this.sandboxes.set(id, sandbox);
    this.resourceTrackers.set(id, {
      memoryUsed: 0,
      cpuTimeMs: 0,
      executionTimeMs: 0,
      fileOperations: 0,
      networkRequests: 0,
      subprocessCount: 0,
      startTime: now,
    });
    return sandbox;
  }

  async run(
    code: () => Promise<unknown>,
    context: ToolExecutionContext
  ): Promise<unknown> {
    const activeSandbox = this.findActiveSandboxForContext(context);
    if (!activeSandbox) {
      return code();
    }

    const tracker = this.resourceTrackers.get(activeSandbox.id);
    if (!tracker) {
      return code();
    }

    const startTime = Date.now();
    const config = activeSandbox.config;

    try {
      this.enforcePreRunChecks(activeSandbox, config);

      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        setTimeout(() => {
          reject(new Error(`Sandbox execution timed out after ${config.maxExecutionTimeMs}ms`));
        }, config.maxExecutionTimeMs);
      });

      const result = await Promise.race([code(), timeoutPromise]);

      const elapsed = Date.now() - startTime;
      tracker.executionTimeMs += elapsed;
      tracker.cpuTimeMs += elapsed;
      this.updateSandboxStats(activeSandbox, tracker);

      return result;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      tracker.executionTimeMs += elapsed;
      tracker.cpuTimeMs += elapsed;
      this.updateSandboxStats(activeSandbox, tracker);
      throw error;
    }
  }

  isolate(sandbox: Sandbox): void {
    const tracked = this.sandboxes.get(sandbox.id);
    if (!tracked) {
      return;
    }
    tracked.config.allowNetwork = false;
    tracked.config.allowFileSystem = false;
    tracked.config.allowSubprocess = false;
    tracked.config.allowedModules = [];
    const blockedSet = new Set(tracked.config.blockedModules);
    for (const mod of this.globalBlockedModules) {
      blockedSet.add(mod);
    }
    tracked.config.blockedModules = Array.from(blockedSet);
    tracked.config.maxFileSizeBytes = 0;
    tracked.config.environmentVariables = {};
  }

  limit(sandbox: Sandbox, resourceLimits: Partial<SandboxConfig>): void {
    const tracked = this.sandboxes.get(sandbox.id);
    if (!tracked) {
      return;
    }
    if (resourceLimits.maxMemoryBytes !== undefined) {
      tracked.config.maxMemoryBytes = resourceLimits.maxMemoryBytes;
    }
    if (resourceLimits.maxCpuTimeMs !== undefined) {
      tracked.config.maxCpuTimeMs = resourceLimits.maxCpuTimeMs;
    }
    if (resourceLimits.maxExecutionTimeMs !== undefined) {
      tracked.config.maxExecutionTimeMs = resourceLimits.maxExecutionTimeMs;
    }
    if (resourceLimits.maxFileSizeBytes !== undefined) {
      tracked.config.maxFileSizeBytes = resourceLimits.maxFileSizeBytes;
    }
    if (resourceLimits.allowNetwork !== undefined) {
      tracked.config.allowNetwork = resourceLimits.allowNetwork;
    }
    if (resourceLimits.allowFileSystem !== undefined) {
      tracked.config.allowFileSystem = resourceLimits.allowFileSystem;
    }
    if (resourceLimits.allowSubprocess !== undefined) {
      tracked.config.allowSubprocess = resourceLimits.allowSubprocess;
    }
    if (resourceLimits.environmentVariables !== undefined) {
      tracked.config.environmentVariables = resourceLimits.environmentVariables;
    }
    if (resourceLimits.allowedModules !== undefined) {
      tracked.config.allowedModules = resourceLimits.allowedModules;
    }
    if (resourceLimits.blockedModules !== undefined) {
      tracked.config.blockedModules = resourceLimits.blockedModules;
    }
  }

  monitor(sandbox: Sandbox): SandboxStats {
    const tracked = this.sandboxes.get(sandbox.id);
    if (!tracked) {
      return {
        sandboxId: sandbox.id,
        memoryUsedBytes: 0,
        cpuTimeMs: 0,
        executionTimeMs: 0,
        fileOperations: 0,
        networkRequests: 0,
        subprocessCount: 0,
        isOverLimit: false,
      };
    }
    const tracker = this.resourceTrackers.get(sandbox.id);
    if (tracker) {
      this.updateSandboxStats(tracked, tracker);
    }
    return { ...tracked.stats };
  }

  cleanup(sandbox: Sandbox): void {
    this.sandboxes.delete(sandbox.id);
    this.resourceTrackers.delete(sandbox.id);
    sandbox.isActive = false;
  }

  getActiveSandboxes(): Sandbox[] {
    return Array.from(this.sandboxes.values()).filter((s) => s.isActive);
  }

  getSandbox(id: string): Sandbox | undefined {
    return this.sandboxes.get(id);
  }

  isModuleAllowed(sandbox: Sandbox, moduleName: string): boolean {
    const tracked = this.sandboxes.get(sandbox.id);
    if (!tracked) {
      return false;
    }
    if (tracked.config.blockedModules.includes(moduleName)) {
      return false;
    }
    if (this.globalBlockedModules.has(moduleName)) {
      return tracked.config.allowedModules.includes(moduleName);
    }
    return true;
  }

  recordFileOperation(sandbox: Sandbox): void {
    const tracker = this.resourceTrackers.get(sandbox.id);
    if (tracker) {
      tracker.fileOperations++;
    }
  }

  recordNetworkRequest(sandbox: Sandbox): void {
    const tracker = this.resourceTrackers.get(sandbox.id);
    if (tracker) {
      tracker.networkRequests++;
    }
  }

  recordSubprocess(sandbox: Sandbox): void {
    const tracker = this.resourceTrackers.get(sandbox.id);
    if (tracker) {
      tracker.subprocessCount++;
    }
  }

  estimateMemoryUsage(sandbox: Sandbox, data: unknown): number {
    const serialized = JSON.stringify(data);
    const bytes = Buffer.byteLength(serialized, "utf-8");
    const tracker = this.resourceTrackers.get(sandbox.id);
    if (tracker) {
      tracker.memoryUsed += bytes;
    }
    return bytes;
  }

  private findActiveSandboxForContext(context: ToolExecutionContext): Sandbox | null {
    if (!context.sandboxed) {
      return null;
    }
    for (const sandbox of this.sandboxes.values()) {
      if (sandbox.isActive) {
        return sandbox;
      }
    }
    return null;
  }

  private enforcePreRunChecks(sandbox: Sandbox, config: SandboxConfig): void {
    const tracker = this.resourceTrackers.get(sandbox.id);
    if (!tracker) return;
    if (config.maxCpuTimeMs > 0 && tracker.cpuTimeMs >= config.maxCpuTimeMs) {
      throw new Error(`Sandbox CPU time limit exceeded: ${tracker.cpuTimeMs}ms >= ${config.maxCpuTimeMs}ms`);
    }
    if (config.maxMemoryBytes > 0 && tracker.memoryUsed >= config.maxMemoryBytes) {
      throw new Error(`Sandbox memory limit exceeded: ${tracker.memoryUsed} bytes >= ${config.maxMemoryBytes} bytes`);
    }
  }

  private updateSandboxStats(sandbox: Sandbox, tracker: ResourceTracker): void {
    sandbox.stats.memoryUsedBytes = tracker.memoryUsed;
    sandbox.stats.cpuTimeMs = tracker.cpuTimeMs;
    sandbox.stats.executionTimeMs = tracker.executionTimeMs;
    sandbox.stats.fileOperations = tracker.fileOperations;
    sandbox.stats.networkRequests = tracker.networkRequests;
    sandbox.stats.subprocessCount = tracker.subprocessCount;
    sandbox.stats.isOverLimit =
      (sandbox.config.maxMemoryBytes > 0 && tracker.memoryUsed > sandbox.config.maxMemoryBytes) ||
      (sandbox.config.maxCpuTimeMs > 0 && tracker.cpuTimeMs > sandbox.config.maxCpuTimeMs) ||
      (sandbox.config.maxExecutionTimeMs > 0 && tracker.executionTimeMs > sandbox.config.maxExecutionTimeMs);
  }
}
