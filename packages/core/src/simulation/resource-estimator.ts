import type { ResourceEstimate, SimulationConfig } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('ResourceEstimator');

export class ResourceEstimator {
  private baselineCpuCores: number = 1;
  private baselineMemoryMB: number = 256;
  private baselineCostPerMs: number = 0.00001;
  private baselineTokensPerStep: number = 500;

  estimate(config: SimulationConfig, pathCount: number, stepsPerPath: number): ResourceEstimate {
    const totalSteps = pathCount * stepsPerPath;
    const cpuCores = this.estimateCpu(config, pathCount);
    const memoryMB = this.estimateMemory(config, pathCount, stepsPerPath);
    const durationMs = this.estimateDuration(config, totalSteps);
    const costEstimate = this.estimateCost(durationMs, totalSteps);
    const tokenEstimate = this.estimateTokens(totalSteps);
    return { cpuCores, memoryMB, durationMs, costEstimate, tokenEstimate };
  }

  private estimateCpu(config: SimulationConfig, pathCount: number): number {
    const parallelFactor = Math.min(config.parallelWorkers, pathCount);
    return this.baselineCpuCores * parallelFactor;
  }

  private estimateMemory(config: SimulationConfig, pathCount: number, stepsPerPath: number): number {
    const perPathMemory = 10;
    const perStepMemory = 0.5;
    const totalPathMemory = pathCount * perPathMemory;
    const totalStepMemory = pathCount * stepsPerPath * perStepMemory;
    return this.baselineMemoryMB + totalPathMemory + totalStepMemory;
  }

  private estimateDuration(config: SimulationConfig, totalSteps: number): number {
    const msPerStep = 100;
    const parallelFactor = Math.min(config.parallelWorkers, 4);
    return (totalSteps * msPerStep) / parallelFactor;
  }

  private estimateCost(durationMs: number, totalSteps: number): number {
    const computeCost = durationMs * this.baselineCostPerMs;
    const tokenCost = totalSteps * this.baselineTokensPerStep * 0.00001;
    return computeCost + tokenCost;
  }

  private estimateTokens(totalSteps: number): number {
    return totalSteps * this.baselineTokensPerStep;
  }

  setBaseline(options: { cpuCores?: number; memoryMB?: number; costPerMs?: number; tokensPerStep?: number }): void {
    if (options.cpuCores !== undefined) this.baselineCpuCores = options.cpuCores;
    if (options.memoryMB !== undefined) this.baselineMemoryMB = options.memoryMB;
    if (options.costPerMs !== undefined) this.baselineCostPerMs = options.costPerMs;
    if (options.tokensPerStep !== undefined) this.baselineTokensPerStep = options.tokensPerStep;
  }
}
