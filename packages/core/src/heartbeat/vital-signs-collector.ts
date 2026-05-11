import type { VitalSigns, SystemMetrics as SharedSystemMetrics, EngineStatus } from "@paracosm/shared";
import { RhythmType } from "@paracosm/shared";
import type {
  VitalSignsInternal,
  ProcessMetrics,
  TaskMetrics,
  ErrorMetrics,
  AggregatedHeartbeat,
  OperationalPhase,
} from "./types.js";
import { SystemMetrics } from "./system-metrics.js";
import { EngineMetrics } from "./engine-metrics.js";
import { ConnectionMetrics } from "./connection-metrics.js";
import { LLMMetrics } from "./llm-metrics.js";

interface NormalizedVitalSigns {
  cpuLoad: number;
  memoryPressure: number;
  diskPressure: number;
  networkLatency: number;
  errorRate: number;
  connectionLoad: number;
  llmLoad: number;
  engineLoad: number;
  overallLoad: number;
}

export class VitalSignsCollector {
  private systemMetrics: SystemMetrics;
  private engineMetrics: EngineMetrics;
  private connectionMetrics: ConnectionMetrics;
  private llmMetrics: LLMMetrics;
  private errorHistory: Array<{ timestamp: number; type: string }>;
  private taskHistory: Array<{ timestamp: number; durationMs: number; success: boolean }>;
  private lastCollectTime: number;

  constructor() {
    this.systemMetrics = new SystemMetrics();
    this.engineMetrics = new EngineMetrics();
    this.connectionMetrics = new ConnectionMetrics();
    this.llmMetrics = new LLMMetrics();
    this.errorHistory = [];
    this.taskHistory = [];
    this.lastCollectTime = Date.now();
  }

  collect(): VitalSignsInternal {
    const system = this.collectSystemMetrics();
    const process = this.collectProcessMetrics();
    const connection = this.collectConnectionMetrics();
    const llm = this.collectLLMMetrics();
    const engines = this.collectEngineMetrics();
    const tasks = this.collectTaskMetrics();
    const errors = this.collectErrorMetrics();

    const cpuTemperature = this.estimateCpuTemperature(system.cpuUsage);
    const memoryPressure = system.memoryUsage;
    const diskHealth = 1 - system.diskUsage;
    const networkLatency = connection.wsPingLatencyMs;
    const processCount = process.openHandles;
    const threadCount = process.openHandles;
    const openFileDescriptors = process.openHandles;
    const errorRate = errors.errorRate;
    const responseTime = llm.avgResponseTimeMs;
    const throughput = llm.tokenThroughput;

    this.lastCollectTime = Date.now();

    return {
      cpuTemperature,
      memoryPressure,
      diskHealth,
      networkLatency,
      processCount,
      threadCount,
      openFileDescriptors,
      errorRate,
      responseTime,
      throughput,
      systemCpuUsage: system.cpuUsage,
      systemMemoryPercentage: system.memoryUsage,
      systemDiskPercentage: system.diskUsage,
      eventLoopLagMs: process.eventLoopLagMs,
      gcPauseMs: process.gcPauseMs,
      openHandles: process.openHandles,
      activeConnections: connection.activeConnections,
      wsPingLatencyMs: connection.wsPingLatencyMs,
      llmActiveRequests: connection.llmActiveRequests,
      llmQueueDepth: llm.queueDepth,
      llmAvgResponseTimeMs: llm.avgResponseTimeMs,
      llmErrorRate: llm.errorRate,
      llmTokenThroughput: llm.tokenThroughput,
      engineErrorCount: engines.errorCount,
      engineIdleCount: engines.idleCount,
      engineRunningCount: engines.runningCount,
      taskPendingCount: tasks.pendingCount,
      taskActiveCount: tasks.activeCount,
      taskFailedCount: tasks.failedCount,
    };
  }

  collectSystemMetrics(): {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkInBytes: number;
    networkOutBytes: number;
    activeConnections: number;
    requestRate: number;
    errorRate: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    uptimeSeconds: number;
    gcPauseMs: number;
    eventLoopLagMs: number;
  } {
    const cpu = this.systemMetrics.cpuUsage();
    const memory = this.systemMetrics.memoryUsage();
    const disk = this.systemMetrics.diskUsage();
    const network = this.systemMetrics.networkStats();
    const processMetrics = this.systemMetrics.processMetrics();

    return {
      cpuUsage: cpu,
      memoryUsage: memory.percentage,
      diskUsage: disk.percentage,
      networkInBytes: network.bytesIn,
      networkOutBytes: network.bytesOut,
      activeConnections: network.connections,
      requestRate: 0,
      errorRate: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      uptimeSeconds: this.systemMetrics.uptime(),
      gcPauseMs: processMetrics.gcPauseMs,
      eventLoopLagMs: processMetrics.eventLoopLagMs,
    };
  }

  collectProcessMetrics(): ProcessMetrics {
    return this.systemMetrics.processMetrics();
  }

  collectConnectionMetrics(): {
    activeConnections: number;
    wsPingLatencyMs: number;
    bytesIn: number;
    bytesOut: number;
    connectionErrors: number;
    reconnectCount: number;
    llmActiveRequests: number;
  } {
    return {
      activeConnections: this.connectionMetrics.wsConnections() + this.connectionMetrics.httpConcurrent(),
      wsPingLatencyMs: this.connectionMetrics.wsPingLatency(),
      bytesIn: this.connectionMetrics.bytesIn(),
      bytesOut: this.connectionMetrics.bytesOut(),
      connectionErrors: this.connectionMetrics.connectionErrors(),
      reconnectCount: this.connectionMetrics.reconnectCount(),
      llmActiveRequests: this.llmMetrics.activeRequests(),
    };
  }

  collectLLMMetrics(): {
    activeRequests: number;
    queueDepth: number;
    avgResponseTimeMs: number;
    errorRate: number;
    tokenThroughput: number;
    costRate: number;
    providerHealth: Record<string, unknown>;
  } {
    return {
      activeRequests: this.llmMetrics.activeRequests(),
      queueDepth: this.llmMetrics.queueDepth(),
      avgResponseTimeMs: this.llmMetrics.avgResponseTime(),
      errorRate: this.llmMetrics.errorRate(),
      tokenThroughput: this.llmMetrics.tokenThroughput(),
      costRate: this.llmMetrics.costRate(),
      providerHealth: this.llmMetrics.providerHealth(),
    };
  }

  collectEngineMetrics(): {
    engines: Record<string, EngineStatus>;
    errorCount: number;
    idleCount: number;
    runningCount: number;
    overallHealth: number;
  } {
    return {
      engines: this.engineMetrics.collectAll(),
      errorCount: this.engineMetrics.errorCount(),
      idleCount: this.engineMetrics.idleCount(),
      runningCount: this.engineMetrics.runningCount(),
      overallHealth: this.engineMetrics.overallHealthScore(),
    };
  }

  collectTaskMetrics(): TaskMetrics {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentTasks = this.taskHistory.filter((t) => t.timestamp >= oneMinuteAgo);
    const completedTasks = recentTasks.filter((t) => t.success);
    const failedTasks = recentTasks.filter((t) => !t.success);

    const avgDuration = completedTasks.length > 0
      ? completedTasks.reduce((sum, t) => sum + t.durationMs, 0) / completedTasks.length
      : 0;

    const maxDuration = completedTasks.length > 0
      ? Math.max(...completedTasks.map((t) => t.durationMs))
      : 0;

    return {
      pendingCount: this.engineMetrics.pendingTaskCount(),
      activeCount: this.engineMetrics.activeTaskCount(),
      completedCount: this.engineMetrics.completedTaskCount(),
      failedCount: failedTasks.length,
      averageDurationMs: avgDuration,
      maxDurationMs: maxDuration,
      throughputPerMinute: completedTasks.length,
    };
  }

  collectErrorMetrics(): ErrorMetrics {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const fiveMinutesAgo = now - 300000;
    const fifteenMinutesAgo = now - 900000;

    const errorsLastMinute = this.errorHistory.filter((e) => e.timestamp >= oneMinuteAgo);
    const errorsLast5Minutes = this.errorHistory.filter((e) => e.timestamp >= fiveMinutesAgo);
    const errorsLast15Minutes = this.errorHistory.filter((e) => e.timestamp >= fifteenMinutesAgo);

    const errorTypes = new Map<string, { count: number; lastOccurrence: string }>();
    for (const error of this.errorHistory) {
      const existing = errorTypes.get(error.type);
      if (existing) {
        existing.count++;
        existing.lastOccurrence = new Date(error.timestamp).toISOString();
      } else {
        errorTypes.set(error.type, {
          count: 1,
          lastOccurrence: new Date(error.timestamp).toISOString(),
        });
      }
    }

    const topErrorTypes = Array.from(errorTypes.entries())
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const totalRequests = this.engineMetrics.completedTaskCount() + this.engineMetrics.failedTaskCount();
    const totalErrors = this.errorHistory.length;
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

    return {
      totalErrors,
      errorsLastMinute: errorsLastMinute.length,
      errorsLast5Minutes: errorsLast5Minutes.length,
      errorsLast15Minutes: errorsLast15Minutes.length,
      errorRate: Math.min(1, errorRate),
      topErrorTypes,
      lastErrorAt: this.errorHistory.length > 0
        ? new Date(this.errorHistory[this.errorHistory.length - 1].timestamp).toISOString()
        : null,
    };
  }

  recordError(type: string): void {
    this.errorHistory.push({ timestamp: Date.now(), type });
    if (this.errorHistory.length > 10000) {
      this.errorHistory.shift();
    }
  }

  recordTask(durationMs: number, success: boolean): void {
    this.taskHistory.push({ timestamp: Date.now(), durationMs, success });
    if (this.taskHistory.length > 10000) {
      this.taskHistory.shift();
    }
  }

  private estimateCpuTemperature(cpuUsage: number): number {
    const baseTemp = 35;
    const maxTemp = 95;
    const estimatedTemp = baseTemp + (maxTemp - baseTemp) * cpuUsage;
    return Math.round(estimatedTemp * 10) / 10;
  }

  aggregate(signs: VitalSignsInternal[]): AggregatedHeartbeat {
    if (signs.length === 0) {
      return {
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        avgBpm: 0,
        minBpm: 0,
        maxBpm: 0,
        dominantPhase: "idle" as OperationalPhase,
        dominantRhythm: RhythmType.Normal,
        avgAmplitude: 0,
        avgErrorRate: 0,
        avgCpuUsage: 0,
        avgMemoryUsage: 0,
        errorCount: 0,
        beatCount: 0,
      };
    }

    const cpuValues = signs.map((s) => s.systemCpuUsage);
    const memValues = signs.map((s) => s.systemMemoryPercentage);
    const errValues = signs.map((s) => s.errorRate);

    const avgCpu = cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length;
    const avgMem = memValues.reduce((a, b) => a + b, 0) / memValues.length;
    const avgErr = errValues.reduce((a, b) => a + b, 0) / errValues.length;

    return {
      startTime: new Date(this.lastCollectTime).toISOString(),
      endTime: new Date().toISOString(),
      avgBpm: 0,
      minBpm: 0,
      maxBpm: 0,
      dominantPhase: "idle" as OperationalPhase,
      dominantRhythm: RhythmType.Normal,
      avgAmplitude: 0,
      avgErrorRate: avgErr,
      avgCpuUsage: avgCpu,
      avgMemoryUsage: avgMem,
      errorCount: signs.reduce((sum, s) => sum + (s.errorRate > 0.5 ? 1 : 0), 0),
      beatCount: signs.length,
    };
  }

  normalize(signs: VitalSignsInternal): NormalizedVitalSigns {
    const cpuLoad = this.clamp(signs.systemCpuUsage, 0, 1);
    const memoryPressure = this.clamp(signs.systemMemoryPercentage, 0, 1);
    const diskPressure = this.clamp(signs.systemDiskPercentage, 0, 1);
    const networkLatency = this.clamp(signs.networkLatency / 1000, 0, 1);
    const errorRate = this.clamp(signs.errorRate, 0, 1);
    const connectionLoad = this.clamp(signs.activeConnections / 1000, 0, 1);
    const llmLoad = this.clamp(
      (signs.llmActiveRequests + signs.llmQueueDepth) / 100,
      0, 1
    );
    const engineLoad = this.clamp(
      signs.engineRunningCount / Math.max(1, signs.engineRunningCount + signs.engineIdleCount),
      0, 1
    );

    const overallLoad = (
      cpuLoad * 0.25 +
      memoryPressure * 0.2 +
      errorRate * 0.2 +
      llmLoad * 0.15 +
      engineLoad * 0.1 +
      connectionLoad * 0.05 +
      diskPressure * 0.05
    );

    return {
      cpuLoad,
      memoryPressure,
      diskPressure,
      networkLatency,
      errorRate,
      connectionLoad,
      llmLoad,
      engineLoad,
      overallLoad: this.clamp(overallLoad, 0, 1),
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  getSystemMetrics(): SystemMetrics {
    return this.systemMetrics;
  }

  getEngineMetrics(): EngineMetrics {
    return this.engineMetrics;
  }

  getConnectionMetrics(): ConnectionMetrics {
    return this.connectionMetrics;
  }

  getLLMMetrics(): LLMMetrics {
    return this.llmMetrics;
  }
}
