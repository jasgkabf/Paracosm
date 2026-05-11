import type { LLMRequest, LLMModel, LLMModelId, RoutingRule } from "@paracosm/shared";
import { Result, ok, err } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";
import type { RoutingDecision } from "./smart-router.js";

const logger = new Logger("RoutingRules");

interface CompiledCondition {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "matches" | "in";
  value: unknown;
  compiled: (request: LLMRequest) => boolean;
}

interface CompiledRule {
  id: string;
  name: string;
  condition: CompiledCondition[];
  targetModelId: LLMModelId;
  priority: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
}

export class RoutingRules {
  private rules: CompiledRule[] = [];

  loadRules(rules: RoutingRule[]): void {
    this.rules = rules
      .filter((r) => r.enabled)
      .map((r) => this.compileRule(r))
      .sort((a, b) => b.priority - a.priority);
    logger.info(`Loaded ${this.rules.length} routing rules`);
  }

  parse(condition: string): CompiledCondition[] {
    const conditions: CompiledCondition[] = [];
    const parts = condition.split(" AND ");

    for (const part of parts) {
      const trimmed = part.trim();
      const operators = [" matches ", " contains ", " in ", " gte ", " lte ", " gt ", " lt ", " neq ", " eq "];
      let parsed = false;

      for (const op of operators) {
        const idx = trimmed.indexOf(op);
        if (idx !== -1) {
          const field = trimmed.substring(0, idx).trim();
          const value = trimmed.substring(idx + op.length).trim();
          const operator = op.trim() as CompiledCondition["operator"];
          conditions.push(this.compileCondition(field, operator, value));
          parsed = true;
          break;
        }
      }

      if (!parsed) {
        conditions.push(this.compileCondition(trimmed, "eq", "true"));
      }
    }

    return conditions;
  }

  evaluate(request: LLMRequest, models: LLMModel[]): Result<RoutingDecision, Error> {
    for (const rule of this.rules) {
      if (!rule.enabled) {
        continue;
      }

      const allMatch = rule.condition.every((cond) => cond.compiled(request));
      if (allMatch) {
        const targetModel = models.find((m) => m.modelId === rule.targetModelId);
        if (targetModel) {
          return ok({
            modelId: rule.targetModelId,
            providerId: targetModel.providerId as string,
            reason: `Rule matched: ${rule.name}`,
            estimatedCost: 0,
            estimatedLatencyMs: targetModel.latencyMs,
            confidence: 0.9,
            alternatives: [],
          });
        }
      }
    }

    return err(new Error("No routing rules matched"));
  }

  match(request: LLMRequest, rule: CompiledRule): boolean {
    if (!rule.enabled) {
      return false;
    }
    return rule.condition.every((cond) => cond.compiled(request));
  }

  prioritize(rules: RoutingRule[]): RoutingRule[] {
    return [...rules].sort((a, b) => b.priority - a.priority);
  }

  resolveConflicts(rules: RoutingRule[]): RoutingRule[] {
    const seen = new Map<string, RoutingRule>();
    const resolved: RoutingRule[] = [];

    const sorted = this.prioritize(rules);
    for (const rule of sorted) {
      const key = rule.condition;
      if (!seen.has(key)) {
        seen.set(key, rule);
        resolved.push(rule);
      } else {
        const existing = seen.get(key)!;
        if (rule.priority > existing.priority) {
          const idx = resolved.findIndex((r) => r.id === existing.id);
          if (idx !== -1) {
            resolved[idx] = rule;
          }
          seen.set(key, rule);
        }
      }
    }

    return resolved;
  }

  addRule(rule: RoutingRule): void {
    const compiled = this.compileRule(rule);
    this.rules.push(compiled);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  removeRule(ruleId: string): boolean {
    const idx = this.rules.findIndex((r) => r.id === ruleId);
    if (idx !== -1) {
      this.rules.splice(idx, 1);
      return true;
    }
    return false;
  }

  getRules(): CompiledRule[] {
    return [...this.rules];
  }

  private compileRule(rule: RoutingRule): CompiledRule {
    return {
      id: rule.id,
      name: rule.name,
      condition: this.parse(rule.condition),
      targetModelId: rule.targetModelId,
      priority: rule.priority,
      enabled: rule.enabled,
      metadata: rule.metadata,
    };
  }

  private compileCondition(field: string, operator: CompiledCondition["operator"], value: string): CompiledCondition {
    let parsedValue: unknown = value;
    if (value === "true") parsedValue = true;
    else if (value === "false") parsedValue = false;
    else if (/^-?\d+$/.test(value)) parsedValue = parseInt(value, 10);
    else if (/^-?\d+\.\d+$/.test(value)) parsedValue = parseFloat(value);
    else if (value.startsWith("[") && value.endsWith("]")) {
      try {
        parsedValue = JSON.parse(value);
      } catch {
        parsedValue = value;
      }
    } else if (value.startsWith("/") && value.endsWith("/")) {
      parsedValue = new RegExp(value.slice(1, -1));
    }

    const compiled = this.buildEvaluator(field, operator, parsedValue);

    return { field, operator, value: parsedValue, compiled };
  }

  private buildEvaluator(field: string, operator: CompiledCondition["operator"], value: unknown): (request: LLMRequest) => boolean {
    return (request: LLMRequest) => {
      const fieldValue = this.getFieldValue(request, field);

      switch (operator) {
        case "eq":
          return fieldValue === value;
        case "neq":
          return fieldValue !== value;
        case "gt":
          return typeof fieldValue === "number" && typeof value === "number" && fieldValue > value;
        case "gte":
          return typeof fieldValue === "number" && typeof value === "number" && fieldValue >= value;
        case "lt":
          return typeof fieldValue === "number" && typeof value === "number" && fieldValue < value;
        case "lte":
          return typeof fieldValue === "number" && typeof value === "number" && fieldValue <= value;
        case "contains":
          if (typeof fieldValue === "string" && typeof value === "string") {
            return fieldValue.includes(value);
          }
          if (Array.isArray(fieldValue)) {
            return fieldValue.includes(value);
          }
          return false;
        case "matches":
          if (typeof fieldValue === "string" && value instanceof RegExp) {
            return value.test(fieldValue);
          }
          if (typeof fieldValue === "string" && typeof value === "string") {
            return new RegExp(value).test(fieldValue);
          }
          return false;
        case "in":
          if (Array.isArray(value)) {
            return value.includes(fieldValue);
          }
          return false;
        default:
          return false;
      }
    };
  }

  private getFieldValue(request: LLMRequest, field: string): unknown {
    const parts = field.split(".");
    let current: unknown = request;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }
}
