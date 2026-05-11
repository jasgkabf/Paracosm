import type { ToolResult } from "@paracosm/shared";
import { ToolError, generateId } from "@paracosm/shared";
import type {
  ToolInternal,
  ToolExecutionContext,
  ToolChain,
  ChainStep,
  ComposedTool,
} from "./types.js";
import { ToolRegistry } from "./tool-registry.js";

export class ToolComposer {
  private registry: ToolRegistry;
  private composedTools: Map<string, ComposedTool> = new Map();

  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }

  compose(tools: ToolInternal[], flow: ToolChain): ComposedTool {
    for (const step of flow.steps) {
      const tool = this.registry.getInternal(step.toolId);
      if (!tool) {
        throw new ToolError(
          `Tool "${step.toolId}" referenced in chain not found in registry`,
          { toolId: step.toolId, chainId: flow.id }
        );
      }
    }
    this.validateStepDependencies(flow);
    const inputSchema = this.buildInputSchema(flow);
    const outputSchema = this.buildOutputSchema(flow);
    const composed: ComposedTool = {
      id: generateId(),
      name: flow.name,
      description: flow.description,
      chain: flow,
      inputSchema,
      outputSchema,
    };
    this.composedTools.set(composed.id, composed);
    return composed;
  }

  decompose(composedTool: ComposedTool): ToolInternal[] {
    const tools: ToolInternal[] = [];
    const seen = new Set<string>();
    for (const step of composedTool.chain.steps) {
      if (seen.has(step.toolId)) {
        continue;
      }
      seen.add(step.toolId);
      const tool = this.registry.getInternal(step.toolId);
      if (tool) {
        tools.push(tool);
      }
    }
    return tools;
  }

  optimize(chain: ToolChain): ToolChain {
    const stepMap = new Map<string, ChainStep>();
    for (const step of chain.steps) {
      stepMap.set(step.id, step);
    }
    const parallelGroups = this.computeParallelGroups(chain.steps);
    const optimizedSteps = this.reorderForEfficiency(chain.steps, stepMap);
    return {
      ...chain,
      steps: optimizedSteps,
      parallelGroups,
    };
  }

  validate(chain: ToolChain): boolean {
    const stepIds = new Set(chain.steps.map((s) => s.id));
    if (chain.steps.length !== stepIds.size) {
      return false;
    }
    for (const step of chain.steps) {
      const tool = this.registry.getInternal(step.toolId);
      if (!tool) {
        return false;
      }
      for (const depId of step.dependsOn) {
        if (!stepIds.has(depId)) {
          return false;
        }
      }
    }
    if (this.hasCircularDependency(chain.steps)) {
      return false;
    }
    for (const group of chain.parallelGroups) {
      for (const stepId of group) {
        if (!stepIds.has(stepId)) {
          return false;
        }
      }
      if (new Set(group).size !== group.length) {
        return false;
      }
    }
    if (chain.maxTotalTimeMs <= 0) {
      return false;
    }
    return true;
  }

  async executeChain(
    chain: ToolChain,
    input: Record<string, unknown>
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const stepResults: Map<string, { data: unknown; success: boolean }> = new Map();
    const executedSteps = new Set<string>();

    const sortedSteps = this.topologicalSort(chain.steps);

    for (const step of sortedSteps) {
      if (step.dependsOn.length > 0) {
        const allDepsMet = step.dependsOn.every((depId) => executedSteps.has(depId));
        if (!allDepsMet) {
          const failedDep = step.dependsOn.find((depId) => {
            const depResult = stepResults.get(depId);
            return !depResult || !depResult.success;
          });
          if (failedDep) {
            return {
              toolId: step.toolId as any,
              success: false,
              data: null,
              error: `Dependency "${failedDep}" failed or was not executed`,
              executionTimeMs: Date.now() - startTime,
              metadata: { chainId: chain.id, failedStep: step.id },
              timestamp: new Date().toISOString(),
            };
          }
        }
      }

      if (step.condition) {
        const conditionMet = this.evaluateCondition(step.condition, stepResults, input);
        if (!conditionMet) {
          executedSteps.add(step.id);
          stepResults.set(step.id, { data: null, success: true });
          continue;
        }
      }

      const resolvedParams = this.resolveParams(step, stepResults, input);
      const tool = this.registry.getInternal(step.toolId);
      if (!tool) {
        return {
          toolId: step.toolId as any,
          success: false,
          data: null,
          error: `Tool "${step.toolId}" not found in registry`,
          executionTimeMs: Date.now() - startTime,
          metadata: { chainId: chain.id, failedStep: step.id },
          timestamp: new Date().toISOString(),
        };
      }

      const context: ToolExecutionContext = {
        sessionId: generateId(),
        userId: "chain-executor",
        roles: [],
        permissions: [],
        metadata: { chainId: chain.id, stepId: step.id },
        parentExecutionId: null,
        timeout: step.timeout,
        sandboxed: false,
        maxRetries: step.retries,
      };

      let lastError: string | null = null;
      let succeeded = false;
      let resultData: unknown = null;

      for (let attempt = 0; attempt <= step.retries; attempt++) {
        try {
          const result = await tool.execute(resolvedParams, context);
          if (result.success) {
            succeeded = true;
            resultData = result.data;
            break;
          }
          lastError = result.error;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
        if (attempt < step.retries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }

      executedSteps.add(step.id);
      stepResults.set(step.id, { data: resultData, success: succeeded });

      if (!succeeded) {
        if (chain.fallbackStrategy === "abort") {
          return {
            toolId: step.toolId as any,
            success: false,
            data: null,
            error: lastError || `Step "${step.id}" failed`,
            executionTimeMs: Date.now() - startTime,
            metadata: { chainId: chain.id, failedStep: step.id, allStepResults: Object.fromEntries(stepResults) },
            timestamp: new Date().toISOString(),
          };
        }
        if (chain.fallbackStrategy === "skip") {
          continue;
        }
      }
    }

    const lastStep = sortedSteps[sortedSteps.length - 1];
    const lastResult = lastStep ? stepResults.get(lastStep.id) : null;

    return {
      toolId: ("chain:" + chain.id) as any,
      success: true,
      data: lastResult?.data ?? Object.fromEntries(stepResults),
      error: null,
      executionTimeMs: Date.now() - startTime,
      metadata: { chainId: chain.id, stepsExecuted: executedSteps.size },
      timestamp: new Date().toISOString(),
    };
  }

  getComposedTool(id: string): ComposedTool | undefined {
    return this.composedTools.get(id);
  }

  listComposedTools(): ComposedTool[] {
    return Array.from(this.composedTools.values());
  }

  removeComposedTool(id: string): void {
    this.composedTools.delete(id);
  }

  private validateStepDependencies(flow: ToolChain): void {
    const stepIds = new Set(flow.steps.map((s) => s.id));
    for (const step of flow.steps) {
      for (const depId of step.dependsOn) {
        if (!stepIds.has(depId)) {
          throw new ToolError(
            `Step "${step.id}" depends on unknown step "${depId}"`,
            { stepId: step.id, dependencyId: depId }
          );
        }
      }
    }
    if (this.hasCircularDependency(flow.steps)) {
      throw new ToolError("Circular dependency detected in tool chain", {
        chainId: flow.id,
      });
    }
  }

  private hasCircularDependency(steps: ChainStep[]): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const stepMap = new Map(steps.map((s) => [s.id, s]));

    const dfs = (stepId: string): boolean => {
      visited.add(stepId);
      recursionStack.add(stepId);
      const step = stepMap.get(stepId);
      if (step) {
        for (const depId of step.dependsOn) {
          if (!visited.has(depId)) {
            if (dfs(depId)) return true;
          } else if (recursionStack.has(depId)) {
            return true;
          }
        }
      }
      recursionStack.delete(stepId);
      return false;
    };

    for (const step of steps) {
      if (!visited.has(step.id)) {
        if (dfs(step.id)) return true;
      }
    }
    return false;
  }

  private topologicalSort(steps: ChainStep[]): ChainStep[] {
    const stepMap = new Map(steps.map((s) => [s.id, s]));
    const visited = new Set<string>();
    const result: ChainStep[] = [];

    const visit = (stepId: string) => {
      if (visited.has(stepId)) return;
      visited.add(stepId);
      const step = stepMap.get(stepId);
      if (step) {
        for (const depId of step.dependsOn) {
          visit(depId);
        }
        result.push(step);
      }
    };

    for (const step of steps) {
      visit(step.id);
    }
    return result;
  }

  private computeParallelGroups(steps: ChainStep[]): string[][] {
    const groups: string[][] = [];
    const assigned = new Set<string>();
    const stepMap = new Map(steps.map((s) => [s.id, s]));

    const sorted = this.topologicalSort(steps);
    let currentGroup: string[] = [];

    for (const step of sorted) {
      const depsAllInPreviousGroups = step.dependsOn.every(
        (depId) => assigned.has(depId)
      );
      if (depsAllInPreviousGroups && currentGroup.length > 0) {
        const allDepsSameGroup = step.dependsOn.every(
          (depId) => currentGroup.includes(depId) || assigned.has(depId)
        );
        if (allDepsSameGroup || step.dependsOn.length === 0) {
          currentGroup.push(step.id);
        } else {
          if (currentGroup.length > 0) {
            groups.push([...currentGroup]);
            currentGroup.forEach((id) => assigned.add(id));
          }
          currentGroup = [step.id];
        }
      } else {
        currentGroup.push(step.id);
      }
    }

    if (currentGroup.length > 0) {
      groups.push([...currentGroup]);
      currentGroup.forEach((id) => assigned.add(id));
    }

    return groups;
  }

  private reorderForEfficiency(
    steps: ChainStep[],
    stepMap: Map<string, ChainStep>
  ): ChainStep[] {
    const sorted = this.topologicalSort(steps);
    return sorted.map((step) => {
      const tool = this.registry.getInternal(step.toolId);
      const priority = tool
        ? tool.permissionLevel === "safe"
          ? 0
          : tool.permissionLevel === "caution"
          ? 1
          : 2
        : 3;
      return { step, priority };
    })
      .sort((a, b) => a.priority - b.priority)
      .map((item) => item.step);
  }

  private resolveParams(
    step: ChainStep,
    stepResults: Map<string, { data: unknown; success: boolean }>,
    input: Record<string, unknown>
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};
    for (const [paramName, mapping] of Object.entries(step.inputMapping)) {
      if (mapping.startsWith("$input.")) {
        const inputKey = mapping.slice(7);
        resolved[paramName] = input[inputKey];
      } else if (mapping.startsWith("$step.")) {
        const parts = mapping.slice(7).split(".");
        const stepId = parts[0];
        const fieldPath = parts.slice(1);
        const stepResult = stepResults.get(stepId);
        if (stepResult) {
          let value = stepResult.data;
          for (const field of fieldPath) {
            if (value && typeof value === "object") {
              value = (value as Record<string, unknown>)[field];
            } else {
              value = undefined;
              break;
            }
          }
          resolved[paramName] = value;
        }
      } else {
        resolved[paramName] = mapping;
      }
    }
    return resolved;
  }

  private evaluateCondition(
    condition: string,
    stepResults: Map<string, { data: unknown; success: boolean }>,
    input: Record<string, unknown>
  ): boolean {
    try {
      if (condition.startsWith("$input.")) {
        const key = condition.slice(7);
        return !!input[key];
      }
      if (condition.startsWith("$step.")) {
        const parts = condition.slice(7).split(".");
        const stepId = parts[0];
        const result = stepResults.get(stepId);
        return result ? result.success : false;
      }
      return !!condition;
    } catch {
      return false;
    }
  }

  private buildInputSchema(chain: ToolChain): Record<string, unknown> {
    const schema: Record<string, unknown> = { type: "object", properties: {}, required: [] };
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const step of chain.steps) {
      for (const [paramName, mapping] of Object.entries(step.inputMapping)) {
        if (mapping.startsWith("$input.")) {
          const inputKey = mapping.slice(7);
          if (!(inputKey in properties)) {
            properties[inputKey] = { type: "string" };
            required.push(inputKey);
          }
        }
      }
    }
    (schema as any).properties = properties;
    (schema as any).required = required;
    return schema;
  }

  private buildOutputSchema(chain: ToolChain): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    for (const step of chain.steps) {
      for (const [outputName, mapping] of Object.entries(step.outputMapping)) {
        properties[outputName] = { type: "object", description: `Output from step ${step.id}` };
      }
    }
    return { type: "object", properties };
  }
}
