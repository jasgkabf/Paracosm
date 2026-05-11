import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { SimulationError } from "@paracosm/shared";
import type {
  PredictionResult,
  SideEffect,
  CostEstimate,
  DurationEstimate,
  UncertaintyRange,
  PredictionModel,
  PathNode,
} from "./types.js";
import { Snapshot } from "./snapshot.js";

interface ActionHistory {
  action: string;
  outcome: string;
  cost: number;
  duration: number;
  sideEffects: string[];
  timestamp: string;
}

export class Predictor {
  private models: Map<string, PredictionModel>;
  private history: ActionHistory[];
  private maxHistorySize: number;

  constructor() {
    this.models = new Map();
    this.history = [];
    this.maxHistorySize = 1000;

    this.initializeDefaultModels();
  }

  predictOutcome(action: PathNode, snapshot: Snapshot): Result<PredictionResult, SimulationError> {
    const model = this.getModelForAction(action.action);
    if (!model) {
      return err(new SimulationError("No prediction model available for action", {
        action: action.action,
      }));
    }

    const costEstimate = this.predictCost(action);
    const durationEstimate = this.predictDuration(action);
    const sideEffects = this.predictSideEffects(action, snapshot);
    const uncertainty = this.uncertaintyQuantification({
      outcome: action.action,
      probability: model.accuracy,
      confidence: model.accuracy,
      sideEffects,
      costEstimate,
      durationEstimate,
      uncertaintyRange: {
        lowerBound: 0,
        upperBound: 1,
        confidenceLevel: 0.95,
        distribution: "normal" as const,
        standardDeviation: 0.1,
      },
    });

    const baseProbability = this.computeBaseProbability(action, model);
    const contextAdjustment = this.computeContextAdjustment(action, snapshot);
    const probability = Math.max(0, Math.min(1, baseProbability * contextAdjustment));

    const confidence = this.confidenceScore({
      outcome: action.action,
      probability,
      confidence: model.accuracy * contextAdjustment,
      sideEffects,
      costEstimate,
      durationEstimate,
      uncertaintyRange: uncertainty,
    });

    const outcome = this.determineOutcome(action, probability);

    const result: PredictionResult = {
      outcome,
      probability,
      confidence,
      sideEffects,
      costEstimate,
      durationEstimate,
      uncertaintyRange: uncertainty,
    };

    this.recordHistory(action, outcome);

    return ok(result);
  }

  predictSideEffects(action: PathNode, snapshot: Snapshot): SideEffect[] {
    const sideEffects: SideEffect[] = [];
    const entityIds = snapshot.getAllEntityIds();
    const relatedActions = this.getRelatedHistory(action.action);

    if (relatedActions.length > 0) {
      const effectFrequency = new Map<string, number>();
      for (const hist of relatedActions) {
        for (const effect of hist.sideEffects) {
          effectFrequency.set(effect, (effectFrequency.get(effect) ?? 0) + 1);
        }
      }

      for (const [description, count] of effectFrequency) {
        const probability = count / relatedActions.length;
        if (probability > 0.1) {
          const affectedEntities = this.findAffectedEntities(action, entityIds);
          sideEffects.push({
            id: `se_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            description,
            probability,
            impact: probability * 0.5,
            affectedEntities: affectedEntities as any[],
            reversible: probability < 0.5,
          });
        }
      }
    }

    if (sideEffects.length === 0) {
      const affectedEntities = this.findAffectedEntities(action, entityIds);
      sideEffects.push({
        id: `se_${Date.now()}_default`,
        description: `Potential state change from ${action.action}`,
        probability: 0.3,
        impact: 0.2,
        affectedEntities: affectedEntities.slice(0, 3) as any[],
        reversible: true,
      });
    }

    if (action.risk > 0.5) {
      sideEffects.push({
        id: `se_${Date.now()}_risk`,
        description: `High-risk action may cause unintended consequences`,
        probability: action.risk * 0.6,
        impact: action.risk * 0.8,
        affectedEntities: [action.entityId] as any[],
        reversible: false,
      });
    }

    return sideEffects;
  }

  predictCost(action: PathNode): CostEstimate {
    const relatedActions = this.getRelatedHistory(action.action);
    let minimum = action.cost * 0.5;
    let expected = action.cost;
    let maximum = action.cost * 2.0;
    let confidence = 0.5;

    if (relatedActions.length > 0) {
      const costs = relatedActions.map((h) => h.cost);
      const avg = costs.reduce((s, c) => s + c, 0) / costs.length;
      const min = Math.min(...costs);
      const max = Math.max(...costs);
      const variance = costs.reduce((s, c) => s + Math.pow(c - avg, 2), 0) / costs.length;

      minimum = min * 0.8;
      expected = avg;
      maximum = max * 1.2;
      confidence = Math.max(0.3, 1.0 - Math.sqrt(variance) / (avg + 0.001));
    }

    const breakdown = new Map<string, number>();
    breakdown.set("computation", expected * 0.4);
    breakdown.set("memory", expected * 0.2);
    breakdown.set("network", expected * 0.2);
    breakdown.set("storage", expected * 0.2);

    return {
      minimum,
      expected,
      maximum,
      confidence,
      breakdown,
    };
  }

  predictDuration(action: PathNode): DurationEstimate {
    const relatedActions = this.getRelatedHistory(action.action);
    let minimumMs = action.duration * 0.5;
    let expectedMs = action.duration;
    let maximumMs = action.duration * 2.0;
    let confidence = 0.5;

    if (relatedActions.length > 0) {
      const durations = relatedActions.map((h) => h.duration);
      const avg = durations.reduce((s, d) => s + d, 0) / durations.length;
      const min = Math.min(...durations);
      const max = Math.max(...durations);
      const variance = durations.reduce((s, d) => s + Math.pow(d - avg, 2), 0) / durations.length;

      minimumMs = min * 0.8;
      expectedMs = avg;
      maximumMs = max * 1.2;
      confidence = Math.max(0.3, 1.0 - Math.sqrt(variance) / (avg + 0.001));
    }

    const breakdown = new Map<string, number>();
    breakdown.set("preprocessing", expectedMs * 0.2);
    breakdown.set("execution", expectedMs * 0.5);
    breakdown.set("postprocessing", expectedMs * 0.15);
    breakdown.set("cleanup", expectedMs * 0.15);

    return {
      minimumMs,
      expectedMs,
      maximumMs,
      confidence,
      breakdown,
    };
  }

  confidenceScore(prediction: PredictionResult): number {
    const model = this.getModelForAction(prediction.outcome);
    const modelAccuracy = model ? model.accuracy : 0.5;

    const sampleConfidence = model
      ? Math.min(1, model.sampleSize / 100)
      : 0.3;

    const costConfidence = prediction.costEstimate.confidence;
    const durationConfidence = prediction.durationEstimate.confidence;

    const sideEffectConfidence = prediction.sideEffects.length > 0
      ? prediction.sideEffects.reduce((s, se) => s + se.probability, 0) / prediction.sideEffects.length
      : 0.5;

    const weightedConfidence =
      modelAccuracy * 0.3 +
      sampleConfidence * 0.2 +
      costConfidence * 0.2 +
      durationConfidence * 0.15 +
      sideEffectConfidence * 0.15;

    return Math.max(0, Math.min(1, weightedConfidence));
  }

  uncertaintyQuantification(prediction: PredictionResult): UncertaintyRange {
    const model = this.getModelForAction(prediction.outcome);
    const sampleSize = model ? model.sampleSize : 10;

    const standardDeviation = sampleSize > 30
      ? 0.1
      : sampleSize > 10
        ? 0.2
        : 0.4;

    const baseValue = prediction.probability;
    const margin = 1.96 * standardDeviation;

    const lowerBound = Math.max(0, baseValue - margin);
    const upperBound = Math.min(1, baseValue + margin);

    const distribution = sampleSize > 30 ? "normal" : sampleSize > 10 ? "triangular" : "uniform";

    return {
      lowerBound,
      upperBound,
      confidenceLevel: 0.95,
      distribution,
      standardDeviation,
    };
  }

  addModel(model: PredictionModel): void {
    this.models.set(model.id, model);
  }

  getModel(id: string): PredictionModel | undefined {
    return this.models.get(id);
  }

  recordObservation(action: string, outcome: string, cost: number, duration: number, sideEffects: string[]): void {
    this.history.push({
      action,
      outcome,
      cost,
      duration,
      sideEffects,
      timestamp: new Date().toISOString(),
    });

    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    this.updateModelForAction(action);
  }

  getHistory(): ActionHistory[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  private initializeDefaultModels(): void {
    const defaultActions = ["create", "update", "delete", "query", "transform", "merge", "split", "validate"];

    for (const action of defaultActions) {
      const model: PredictionModel = {
        id: `model_${action}`,
        name: `${action} prediction model`,
        version: 1,
        accuracy: 0.6 + Math.random() * 0.2,
        sampleSize: Math.floor(Math.random() * 50) + 10,
        lastTrainedAt: new Date().toISOString(),
        predictions: new Map(),
        confidenceThreshold: 0.5,
      };

      this.models.set(model.id, model);
    }
  }

  private getModelForAction(action: string): PredictionModel | undefined {
    const directKey = `model_${action}`;
    if (this.models.has(directKey)) {
      return this.models.get(directKey);
    }

    for (const [id, model] of this.models) {
      if (action.includes(model.name.split(" ")[0])) {
        return model;
      }
    }

    return this.models.values().next().value;
  }

  private computeBaseProbability(action: PathNode, model: PredictionModel): number {
    const storedPrediction = model.predictions.get(action.action);
    if (storedPrediction !== undefined) {
      return storedPrediction;
    }

    const relatedHistory = this.getRelatedHistory(action.action);
    if (relatedHistory.length > 0) {
      const successCount = relatedHistory.filter((h) => h.outcome === "success").length;
      return successCount / relatedHistory.length;
    }

    return model.accuracy;
  }

  private computeContextAdjustment(action: PathNode, snapshot: Snapshot): number {
    let adjustment = 1.0;

    const entityCount = snapshot.getEntityCount();
    if (entityCount > 1000) {
      adjustment *= 0.9;
    } else if (entityCount > 100) {
      adjustment *= 0.95;
    }

    if (action.risk > 0.7) {
      adjustment *= 0.8;
    } else if (action.risk > 0.4) {
      adjustment *= 0.9;
    }

    if (action.cost > 1.0) {
      adjustment *= 0.85;
    }

    return adjustment;
  }

  private determineOutcome(action: PathNode, probability: number): string {
    if (probability > 0.8) return "success";
    if (probability > 0.5) return "partial_success";
    if (probability > 0.3) return "uncertain";
    return "failure";
  }

  private getRelatedHistory(action: string): ActionHistory[] {
    return this.history.filter((h) => h.action === action);
  }

  private findAffectedEntities(action: PathNode, entityIds: string[]): string[] {
    const affected: string[] = [action.entityId as string];
    const idx = entityIds.indexOf(action.entityId as string);
    if (idx >= 0 && idx + 1 < entityIds.length) {
      affected.push(entityIds[idx + 1]);
    }
    if (idx > 0) {
      affected.push(entityIds[idx - 1]);
    }
    return affected;
  }

  private recordHistory(action: PathNode, outcome: string): void {
    this.history.push({
      action: action.action,
      outcome,
      cost: action.cost,
      duration: action.duration,
      sideEffects: [],
      timestamp: new Date().toISOString(),
    });

    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  private updateModelForAction(action: string): void {
    const model = this.getModelForAction(action);
    if (!model) return;

    const relatedHistory = this.getRelatedHistory(action);
    if (relatedHistory.length < 5) return;

    const successCount = relatedHistory.filter((h) => h.outcome === "success").length;
    const newAccuracy = successCount / relatedHistory.length;

    model.accuracy = model.accuracy * 0.7 + newAccuracy * 0.3;
    model.sampleSize = relatedHistory.length;
    model.lastTrainedAt = new Date().toISOString();
    model.predictions.set(action, model.accuracy);
  }
}
