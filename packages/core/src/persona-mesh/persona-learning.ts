import type { Persona, PersonaState } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';
import type { LearningDataPoint } from './types.js';

const logger = createLogger('PersonaLearning');

export interface LearningModel {
  personaId: string;
  taskTypeWeights: Map<string, number>;
  successRates: Map<string, number>;
  latencyProfiles: Map<string, number>;
  adaptationHistory: Array<{ timestamp: Date; adjustment: string; impact: number }>;
  lastUpdated: Date;
}

export class PersonaLearning {
  private models: Map<string, LearningModel> = new Map();
  private dataPoints: Map<string, LearningDataPoint[]> = new Map();
  private adaptationRate: number;

  constructor(adaptationRate: number = 0.1) {
    this.adaptationRate = adaptationRate;
  }

  recordDataPoint(data: LearningDataPoint): void {
    const points = this.dataPoints.get(data.personaId) ?? [];
    points.push(data);
    if (points.length > 1000) points.shift();
    this.dataPoints.set(data.personaId, points);
    this.updateModel(data.personaId);
  }

  private updateModel(personaId: string): void {
    const points = this.dataPoints.get(personaId);
    if (!points || points.length < 3) return;
    let model = this.models.get(personaId);
    if (!model) {
      model = {
        personaId,
        taskTypeWeights: new Map(),
        successRates: new Map(),
        latencyProfiles: new Map(),
        adaptationHistory: [],
        lastUpdated: new Date(),
      };
      this.models.set(personaId, model);
    }
    const recentPoints = points.slice(-50);
    const byTaskType = new Map<string, LearningDataPoint[]>();
    for (const point of recentPoints) {
      const list = byTaskType.get(point.taskType) ?? [];
      list.push(point);
      byTaskType.set(point.taskType, list);
    }
    for (const [taskType, taskPoints] of byTaskType) {
      const successRate = taskPoints.filter((p) => p.success).length / taskPoints.length;
      const avgLatency = taskPoints.reduce((sum, p) => sum + p.latencyMs, 0) / taskPoints.length;
      const currentRate = model.successRates.get(taskType) ?? 0.5;
      const adaptedRate = currentRate * (1 - this.adaptationRate) + successRate * this.adaptationRate;
      model.successRates.set(taskType, adaptedRate);
      model.latencyProfiles.set(taskType, avgLatency);
      const currentWeight = model.taskTypeWeights.get(taskType) ?? 1.0;
      const newWeight = currentWeight * (1 - this.adaptationRate) + (successRate * 2) * this.adaptationRate;
      model.taskTypeWeights.set(taskType, Math.min(Math.max(newWeight, 0.1), 3.0));
    }
    model.lastUpdated = new Date();
  }

  getRecommendedWeight(personaId: string, taskType: string): number {
    const model = this.models.get(personaId);
    if (!model) return 1.0;
    return model.taskTypeWeights.get(taskType) ?? 1.0;
  }

  getPredictedSuccessRate(personaId: string, taskType: string): number {
    const model = this.models.get(personaId);
    if (!model) return 0.5;
    return model.successRates.get(taskType) ?? 0.5;
  }

  getPredictedLatency(personaId: string, taskType: string): number {
    const model = this.models.get(personaId);
    if (!model) return 5000;
    return model.latencyProfiles.get(taskType) ?? 5000;
  }

  getPerformanceTrend(personaId: string): 'improving' | 'stable' | 'declining' {
    const points = this.dataPoints.get(personaId);
    if (!points || points.length < 10) return 'stable';
    const recent = points.slice(-10);
    const older = points.slice(-20, -10);
    if (older.length === 0) return 'stable';
    const recentSuccessRate = recent.filter((p) => p.success).length / recent.length;
    const olderSuccessRate = older.filter((p) => p.success).length / older.length;
    const diff = recentSuccessRate - olderSuccessRate;
    if (diff > 0.1) return 'improving';
    if (diff < -0.1) return 'declining';
    return 'stable';
  }

  getModel(personaId: string): LearningModel | undefined {
    return this.models.get(personaId);
  }

  getAllModels(): Map<string, LearningModel> {
    return new Map(this.models);
  }

  clear(): void {
    this.models.clear();
    this.dataPoints.clear();
  }
}
