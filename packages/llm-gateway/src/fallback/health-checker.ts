import { EventEmitter } from "node:events";
import type { ProviderHealth, LLMModelId } from "@paracosm/shared";
import { Result, ok, err } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";

const logger = new Logger("HealthChecker");

interface HealthRecord {
  providerId: string;
  isHealthy: boolean;
  latencyMs: number;
  errorRate: number;
  successRate: number;
  lastError: string | null;
  lastSuccessAt: string | null;
  lastCheckAt: string;
  consecutiveErrors: number;
  totalChecks: number;
  totalErrors: number;
}

interface HealthCheckSchedule {
  providerId: string;
  intervalMs: number;
  lastRun: number;
  running: boolean;
}

export class HealthChecker extends EventEmitter {
  private healthRecords: Map<string, HealthRecord> = new Map();
  private schedules: Map<string, HealthCheckSchedule> = new Map();
  private checkTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private threshold: { maxErrorRate: number; maxLatencyMs: number; minConsecutiveErrors: number } = {
    maxErrorRate: 0.5,
    maxLatencyMs: 30000,
    minConsecutiveErrors: 3,
  };

  async check(modelId: string): Promise<Result<ProviderHealth, Error>> {
    const record = this.healthRecords.get(modelId);
    const now = new Date().toISOString();

    if (!record) {
      const defaultHealth: ProviderHealth = {
        providerId: modelId as any,
        isHealthy: true,
        latencyMs: 0,
        errorRate: 0,
        successRate: 1,
        lastError: null,
        lastSuccessAt: now,
        lastCheckAt: now,
        consecutiveErrors: 0,
        circuitOpen: false,
        circuitOpenUntil: null,
      };
      return ok(defaultHealth);
    }

    const health: ProviderHealth = {
      providerId: record.providerId as any,
      isHealthy: record.isHealthy,
      latencyMs: record.latencyMs,
      errorRate: record.errorRate,
      successRate: record.successRate,
      lastError: record.lastError,
      lastSuccessAt: record.lastSuccessAt,
      lastCheckAt: record.lastCheckAt,
      consecutiveErrors: record.consecutiveErrors,
      circuitOpen: !record.isHealthy && record.consecutiveErrors >= this.threshold.minConsecutiveErrors,
      circuitOpenUntil: null,
    };

    return ok(health);
  }

  schedule(providerId: string, intervalMs: number, checkFn: () => Promise<boolean>): void {
    const existing = this.checkTimers.get(providerId);
    if (existing) {
      clearInterval(existing);
    }

    this.schedules.set(providerId, {
      providerId,
      intervalMs,
      lastRun: 0,
      running: false,
    });

    const timer = setInterval(async () => {
      const schedule = this.schedules.get(providerId);
      if (!schedule || schedule.running) return;

      schedule.running = true;
      try {
        const isHealthy = await checkFn();
        this.recordCheck(providerId, isHealthy);
        schedule.lastRun = Date.now();
      } catch (error) {
        this.recordCheck(providerId, false, error instanceof Error ? error.message : String(error));
      } finally {
        schedule.running = false;
      }
    }, intervalMs);

    this.checkTimers.set(providerId, timer);
    logger.info(`Scheduled health check for ${providerId} every ${intervalMs}ms`);
  }

  aggregate(): { healthy: number; unhealthy: number; total: number; details: Map<string, HealthRecord> } {
    let healthy = 0;
    let unhealthy = 0;

    for (const record of this.healthRecords.values()) {
      if (record.isHealthy) {
        healthy++;
      } else {
        unhealthy++;
      }
    }

    return {
      healthy,
      unhealthy,
      total: this.healthRecords.size,
      details: new Map(this.healthRecords),
    };
  }

  setThreshold(config: Partial<typeof this.threshold>): void {
    this.threshold = { ...this.threshold, ...config };
  }

  alert(): { modelId: string; isHealthy: boolean; errorRate: number; consecutiveErrors: number }[] {
    const alerts: { modelId: string; isHealthy: boolean; errorRate: number; consecutiveErrors: number }[] = [];

    for (const [modelId, record] of this.healthRecords.entries()) {
      if (!record.isHealthy || record.errorRate > this.threshold.maxErrorRate || record.consecutiveErrors >= this.threshold.minConsecutiveErrors) {
        alerts.push({
          modelId,
          isHealthy: record.isHealthy,
          errorRate: record.errorRate,
          consecutiveErrors: record.consecutiveErrors,
        });
      }
    }

    return alerts;
  }

  recordCheck(providerId: string, success: boolean, errorMessage?: string): void {
    const now = new Date().toISOString();
    const record = this.healthRecords.get(providerId) ?? {
      providerId,
      isHealthy: true,
      latencyMs: 0,
      errorRate: 0,
      successRate: 1,
      lastError: null,
      lastSuccessAt: null,
      lastCheckAt: now,
      consecutiveErrors: 0,
      totalChecks: 0,
      totalErrors: 0,
    };

    record.totalChecks++;
    record.lastCheckAt = now;

    if (success) {
      record.consecutiveErrors = 0;
      record.lastSuccessAt = now;
      record.lastError = null;
    } else {
      record.consecutiveErrors++;
      record.totalErrors++;
      record.lastError = errorMessage ?? "Health check failed";
    }

    record.errorRate = record.totalChecks > 0 ? record.totalErrors / record.totalChecks : 0;
    record.successRate = 1 - record.errorRate;
    record.isHealthy = record.consecutiveErrors < this.threshold.minConsecutiveErrors && record.errorRate < this.threshold.maxErrorRate;

    this.healthRecords.set(providerId, record);

    if (!record.isHealthy) {
      this.emit("unhealthy", { providerId, record });
    }
  }

  stopSchedule(providerId: string): void {
    const timer = this.checkTimers.get(providerId);
    if (timer) {
      clearInterval(timer);
      this.checkTimers.delete(providerId);
      this.schedules.delete(providerId);
    }
  }

  stopAll(): void {
    for (const timer of this.checkTimers.values()) {
      clearInterval(timer);
    }
    this.checkTimers.clear();
    this.schedules.clear();
  }
}
