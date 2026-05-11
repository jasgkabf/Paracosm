import { EventEmitter } from "node:events";
import { Logger } from "@paracosm/shared";

const logger = new Logger("RecoveryManager");

interface RecoveryState {
  modelId: string;
  status: "recovering" | "recovered" | "failed";
  attempts: number;
  lastAttemptAt: number;
  lastError: string | null;
  recoveredAt: string | null;
}

export class RecoveryManager extends EventEmitter {
  private recoveryStates: Map<string, RecoveryState> = new Map();
  private maxRecoveryAttempts: number = 5;
  private recoveryIntervalMs: number = 30000;
  private recoveryTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private notifications: { modelId: string; status: string; timestamp: string; message: string }[] = [];

  recover(modelId: string): void {
    const state = this.recoveryStates.get(modelId) ?? {
      modelId,
      status: "recovering" as const,
      attempts: 0,
      lastAttemptAt: 0,
      lastError: null,
      recoveredAt: null,
    };

    state.status = "recovering";
    state.attempts++;
    state.lastAttemptAt = Date.now();
    this.recoveryStates.set(modelId, state);

    this.emit("recovery_started", { modelId, attempt: state.attempts });
    logger.info(`Recovery started for ${modelId}, attempt ${state.attempts}`);
  }

  async testRecovery(modelId: string, testFn: () => Promise<boolean>): Promise<boolean> {
    try {
      const success = await testFn();

      if (success) {
        this.markRecovered(modelId);
        return true;
      } else {
        this.markFailed(modelId, "Recovery test failed");
        return false;
      }
    } catch (error) {
      this.markFailed(modelId, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  autoSwitch(fromModelId: string, toModelId: string, reason: string): void {
    this.emit("auto_switch", { fromModelId, toModelId, reason });
    logger.info(`Auto-switching from ${fromModelId} to ${toModelId}: ${reason}`);

    this.notifications.push({
      modelId: fromModelId,
      status: "switched",
      timestamp: new Date().toISOString(),
      message: `Switched to ${toModelId}: ${reason}`,
    });
  }

  getRecoveryState(modelId: string): RecoveryState | undefined {
    return this.recoveryStates.get(modelId);
  }

  getAllRecoveryStates(): Map<string, RecoveryState> {
    return new Map(this.recoveryStates);
  }

  getNotifications(): { modelId: string; status: string; timestamp: string; message: string }[] {
    return [...this.notifications];
  }

  private markRecovered(modelId: string): void {
    const state = this.recoveryStates.get(modelId);
    if (state) {
      state.status = "recovered";
      state.recoveredAt = new Date().toISOString();
      state.lastError = null;
    }

    const timer = this.recoveryTimers.get(modelId);
    if (timer) {
      clearTimeout(timer);
      this.recoveryTimers.delete(modelId);
    }

    this.notifications.push({
      modelId,
      status: "recovered",
      timestamp: new Date().toISOString(),
      message: "Model recovered successfully",
    });

    this.emit("recovered", { modelId });
    logger.info(`Model ${modelId} recovered successfully`);
  }

  private markFailed(modelId: string, error: string): void {
    const state = this.recoveryStates.get(modelId);
    if (state) {
      state.status = "failed";
      state.lastError = error;
    }

    this.notifications.push({
      modelId,
      status: "failed",
      timestamp: new Date().toISOString(),
      message: error,
    });

    this.emit("recovery_failed", { modelId, error });
    logger.warn(`Recovery failed for ${modelId}: ${error}`);
  }
}
