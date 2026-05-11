import type { EngineStatus } from "@paracosm/shared";
import type { EngineMetricsSnapshot } from "./types.js";

interface EngineRegistryEntry {
  id: string;
  name: string;
  getStatus: () => EngineStatus;
}

export class EngineMetrics {
  private engines: Map<string, EngineRegistryEntry>;
  private lastSnapshot: EngineMetricsSnapshot | null;
  private snapshotTimestamp: string;

  constructor() {
    this.engines = new Map();
    this.lastSnapshot = null;
    this.snapshotTimestamp = new Date().toISOString();
    this.registerDefaultEngines();
  }

  private registerDefaultEngines(): void {
    this.engines.set("worldModel", {
      id: "worldModel",
      name: "World Model Engine",
      getStatus: () => this.worldModelState(),
    });
    this.engines.set("personaMesh", {
      id: "personaMesh",
      name: "Persona Mesh Engine",
      getStatus: () => this.personaMeshState(),
    });
    this.engines.set("simulation", {
      id: "simulation",
      name: "Simulation Engine",
      getStatus: () => this.simulationState(),
    });
    this.engines.set("strategy", {
      id: "strategy",
      name: "Strategy Engine",
      getStatus: () => this.strategyState(),
    });
    this.engines.set("memory", {
      id: "memory",
      name: "Memory Engine",
      getStatus: () => this.memoryState(),
    });
    this.engines.set("tools", {
      id: "tools",
      name: "Tool Engine",
      getStatus: () => this.toolState(),
    });
    this.engines.set("orchestrator", {
      id: "orchestrator",
      name: "Orchestrator Engine",
      getStatus: () => this.orchestratorState(),
    });
  }

  registerEngine(id: string, name: string, getStatus: () => EngineStatus): void {
    this.engines.set(id, { id, name, getStatus });
  }

  unregisterEngine(id: string): void {
    this.engines.delete(id);
  }

  private createEngineStatus(
    engineId: string,
    name: string,
    overrides?: Partial<EngineStatus>
  ): EngineStatus {
    const now = new Date().toISOString();
    return {
      engineId,
      name,
      status: overrides?.status ?? "idle",
      lastActivityAt: overrides?.lastActivityAt ?? now,
      tasksCompleted: overrides?.tasksCompleted ?? 0,
      tasksPending: overrides?.tasksPending ?? 0,
      tasksFailed: overrides?.tasksFailed ?? 0,
      averageTaskDurationMs: overrides?.averageTaskDurationMs ?? 0,
      healthScore: overrides?.healthScore ?? 1.0,
    };
  }

  worldModelState(): EngineStatus {
    return this.createEngineStatus("worldModel", "World Model Engine", {
      status: "idle",
      healthScore: 1.0,
      tasksCompleted: 0,
      tasksPending: 0,
      tasksFailed: 0,
      averageTaskDurationMs: 0,
    });
  }

  personaMeshState(): EngineStatus {
    return this.createEngineStatus("personaMesh", "Persona Mesh Engine", {
      status: "idle",
      healthScore: 1.0,
      tasksCompleted: 0,
      tasksPending: 0,
      tasksFailed: 0,
      averageTaskDurationMs: 0,
    });
  }

  simulationState(): EngineStatus {
    return this.createEngineStatus("simulation", "Simulation Engine", {
      status: "idle",
      healthScore: 1.0,
      tasksCompleted: 0,
      tasksPending: 0,
      tasksFailed: 0,
      averageTaskDurationMs: 0,
    });
  }

  strategyState(): EngineStatus {
    return this.createEngineStatus("strategy", "Strategy Engine", {
      status: "idle",
      healthScore: 1.0,
      tasksCompleted: 0,
      tasksPending: 0,
      tasksFailed: 0,
      averageTaskDurationMs: 0,
    });
  }

  memoryState(): EngineStatus {
    return this.createEngineStatus("memory", "Memory Engine", {
      status: "idle",
      healthScore: 1.0,
      tasksCompleted: 0,
      tasksPending: 0,
      tasksFailed: 0,
      averageTaskDurationMs: 0,
    });
  }

  toolState(): EngineStatus {
    return this.createEngineStatus("tools", "Tool Engine", {
      status: "idle",
      healthScore: 1.0,
      tasksCompleted: 0,
      tasksPending: 0,
      tasksFailed: 0,
      averageTaskDurationMs: 0,
    });
  }

  orchestratorState(): EngineStatus {
    return this.createEngineStatus("orchestrator", "Orchestrator Engine", {
      status: "idle",
      healthScore: 1.0,
      tasksCompleted: 0,
      tasksPending: 0,
      tasksFailed: 0,
      averageTaskDurationMs: 0,
    });
  }

  collectAll(): Record<string, EngineStatus> {
    const result: Record<string, EngineStatus> = {};
    for (const [id, entry] of this.engines) {
      try {
        result[id] = entry.getStatus();
      } catch {
        result[id] = this.createEngineStatus(id, entry.name, {
          status: "error",
          healthScore: 0,
        });
      }
    }
    return result;
  }

  snapshot(): EngineMetricsSnapshot {
    const all = this.collectAll();
    this.lastSnapshot = {
      worldModel: all.worldModel ?? this.worldModelState(),
      personaMesh: all.personaMesh ?? this.personaMeshState(),
      simulation: all.simulation ?? this.simulationState(),
      strategy: all.strategy ?? this.strategyState(),
      memory: all.memory ?? this.memoryState(),
      tools: all.tools ?? this.toolState(),
      orchestrator: all.orchestrator ?? this.orchestratorState(),
    };
    this.snapshotTimestamp = new Date().toISOString();
    return this.lastSnapshot;
  }

  getLastSnapshot(): EngineMetricsSnapshot | null {
    return this.lastSnapshot;
  }

  getSnapshotTimestamp(): string {
    return this.snapshotTimestamp;
  }

  overallHealthScore(): number {
    const all = this.collectAll();
    const statuses = Object.values(all);
    if (statuses.length === 0) return 1.0;

    let totalScore = 0;
    for (const status of statuses) {
      totalScore += status.healthScore;
    }
    return totalScore / statuses.length;
  }

  errorCount(): number {
    const all = this.collectAll();
    let count = 0;
    for (const status of Object.values(all)) {
      if (status.status === "error") count++;
      count += status.tasksFailed;
    }
    return count;
  }

  idleCount(): number {
    const all = this.collectAll();
    let count = 0;
    for (const status of Object.values(all)) {
      if (status.status === "idle") count++;
    }
    return count;
  }

  runningCount(): number {
    const all = this.collectAll();
    let count = 0;
    for (const status of Object.values(all)) {
      if (status.status === "running") count++;
    }
    return count;
  }

  pendingTaskCount(): number {
    const all = this.collectAll();
    let count = 0;
    for (const status of Object.values(all)) {
      count += status.tasksPending;
    }
    return count;
  }

  activeTaskCount(): number {
    const all = this.collectAll();
    let count = 0;
    for (const status of Object.values(all)) {
      if (status.status === "running") {
        count += Math.max(1, status.tasksPending);
      }
    }
    return count;
  }

  failedTaskCount(): number {
    const all = this.collectAll();
    let count = 0;
    for (const status of Object.values(all)) {
      count += status.tasksFailed;
    }
    return count;
  }

  completedTaskCount(): number {
    const all = this.collectAll();
    let count = 0;
    for (const status of Object.values(all)) {
      count += status.tasksCompleted;
    }
    return count;
  }

  averageTaskDuration(): number {
    const all = this.collectAll();
    let totalDuration = 0;
    let totalTasks = 0;
    for (const status of Object.values(all)) {
      if (status.tasksCompleted > 0) {
        totalDuration += status.averageTaskDurationMs * status.tasksCompleted;
        totalTasks += status.tasksCompleted;
      }
    }
    return totalTasks > 0 ? totalDuration / totalTasks : 0;
  }

  hasErrors(): boolean {
    const all = this.collectAll();
    for (const status of Object.values(all)) {
      if (status.status === "error") return true;
      if (status.tasksFailed > 0) return true;
    }
    return false;
  }

  isAllIdle(): boolean {
    const all = this.collectAll();
    for (const status of Object.values(all)) {
      if (status.status !== "idle" && status.status !== "stopped") return false;
    }
    return true;
  }

  isAllRunning(): boolean {
    const all = this.collectAll();
    if (Object.keys(all).length === 0) return false;
    for (const status of Object.values(all)) {
      if (status.status !== "running") return false;
    }
    return true;
  }
}
