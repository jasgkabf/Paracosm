import { EventEmitter } from "node:events";
import { Logger } from "@paracosm/shared";

const logger = new Logger("DegradationHandler");

export type DegradationLevel = "none" | "minimal" | "moderate" | "severe" | "critical";

interface DegradationRule {
  level: DegradationLevel;
  conditions: {
    maxErrorRate: number;
    maxLatencyMs: number;
    minAvailableModels: number;
  };
  actions: string[];
}

const DEGRADATION_LEVELS: DegradationRule[] = [
  {
    level: "none",
    conditions: { maxErrorRate: 0, maxLatencyMs: 0, minAvailableModels: Infinity },
    actions: [],
  },
  {
    level: "minimal",
    conditions: { maxErrorRate: 0.1, maxLatencyMs: 10000, minAvailableModels: 3 },
    actions: ["increase_timeout", "prefer_reliable_models"],
  },
  {
    level: "moderate",
    conditions: { maxErrorRate: 0.25, maxLatencyMs: 20000, minAvailableModels: 2 },
    actions: ["disable_streaming", "reduce_max_tokens", "skip_non_essential_features"],
  },
  {
    level: "severe",
    conditions: { maxErrorRate: 0.5, maxLatencyMs: 45000, minAvailableModels: 1 },
    actions: ["use_cheapest_model", "disable_function_calling", "minimal_context"],
  },
  {
    level: "critical",
    conditions: { maxErrorRate: 1, maxLatencyMs: Infinity, minAvailableModels: 0 },
    actions: ["queue_requests", "reject_non_critical", "notify_admins"],
  },
];

export class DegradationHandler extends EventEmitter {
  private currentLevel: DegradationLevel = "none";
  private degradedModels: Map<string, { level: DegradationLevel; reason: string; since: string }> = new Map();
  private notifications: { level: DegradationLevel; message: string; timestamp: string }[] = [];

  detect(type: string, context: Record<string, unknown>): DegradationLevel {
    const newLevel = this.classifyDegradation(type, context);

    if (this.compareLevels(newLevel, this.currentLevel) > 0) {
      const previousLevel = this.currentLevel;
      this.currentLevel = newLevel;

      this.emit("degraded", {
        from: previousLevel,
        to: newLevel,
        type,
        context,
      });

      logger.warn(`Degradation level changed: ${previousLevel} -> ${newLevel} (${type})`);
      this.notify(newLevel, `Degradation from ${previousLevel} to ${newLevel}: ${type}`);
    }

    return this.currentLevel;
  }

  classify(type: string, context: Record<string, unknown>): DegradationLevel {
    return this.classifyDegradation(type, context);
  }

  respond(level: DegradationLevel): string[] {
    const rule = DEGRADATION_LEVELS.find((r) => r.level === level);
    return rule?.actions ?? [];
  }

  notify(level: DegradationLevel, message: string): void {
    const notification = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    this.notifications.push(notification);
    if (this.notifications.length > 100) {
      this.notifications.shift();
    }

    this.emit("notification", notification);
  }

  recover(modelId: string): void {
    this.degradedModels.delete(modelId);

    if (this.degradedModels.size === 0) {
      this.currentLevel = "none";
      this.emit("recovered", { modelId });
      logger.info(`Degradation recovered for ${modelId}`);
    }
  }

  autoRecover(): void {
    const now = Date.now();
    for (const [modelId, entry] of this.degradedModels.entries()) {
      const since = new Date(entry.since).getTime();
      const elapsed = now - since;

      if (elapsed > 300000 && entry.level !== "critical") {
        this.recover(modelId);
      }
    }
  }

  getLevel(): DegradationLevel {
    return this.currentLevel;
  }

  getActions(): string[] {
    return this.respond(this.currentLevel);
  }

  getDegradedModels(): Map<string, { level: DegradationLevel; reason: string; since: string }> {
    return new Map(this.degradedModels);
  }

  getNotifications(): { level: DegradationLevel; message: string; timestamp: string }[] {
    return [...this.notifications];
  }

  private classifyDegradation(type: string, context: Record<string, unknown>): DegradationLevel {
    switch (type) {
      case "all_models_failed":
        return "critical";
      case "high_error_rate": {
        const errorRate = context.errorRate as number ?? 0;
        if (errorRate >= 0.5) return "severe";
        if (errorRate >= 0.25) return "moderate";
        if (errorRate >= 0.1) return "minimal";
        return "none";
      }
      case "high_latency": {
        const latency = context.latencyMs as number ?? 0;
        if (latency >= 45000) return "severe";
        if (latency >= 20000) return "moderate";
        if (latency >= 10000) return "minimal";
        return "none";
      }
      case "rate_limited":
        return "moderate";
      case "timeout":
        return "minimal";
      case "provider_down":
        return "severe";
      default:
        return "minimal";
    }
  }

  private compareLevels(a: DegradationLevel, b: DegradationLevel): number {
    const order: DegradationLevel[] = ["none", "minimal", "moderate", "severe", "critical"];
    return order.indexOf(a) - order.indexOf(b);
  }
}
