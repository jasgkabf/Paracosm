import type { Result } from "@paracosm/shared";
import { ok, err } from "@paracosm/shared";
import { ConstraintType, ConstraintStatus } from "@paracosm/shared";
import { generateId } from "@paracosm/shared";
import { ValidationError } from "@paracosm/shared";
import type { ConstraintRecord, ConstraintConflict } from "./types.js";

interface ConstraintCreateParams {
  name: string;
  type: ConstraintType;
  description?: string;
  expression: string;
  priority?: number;
  penalty?: number;
  scope?: string[];
  status?: ConstraintStatus;
}

const VALID_CONSTRAINT_TYPES = new Set<string>(Object.values(ConstraintType));
const VALID_CONSTRAINT_STATUSES = new Set<string>(Object.values(ConstraintStatus));

export class Constraint {
  static create(params: ConstraintCreateParams): Result<ConstraintRecord, ValidationError> {
    const validation = Constraint.validateParams(params);
    if (!validation.ok) {
      return validation;
    }

    const now = new Date().toISOString();
    const id = `cstr_${generateId()}`;

    const scope = new Set<string>(params.scope ?? []);

    const record: ConstraintRecord = {
      id,
      name: params.name,
      constraintType: params.type,
      status: params.status ?? ConstraintStatus.Active,
      description: params.description ?? "",
      expression: params.expression,
      priority: params.priority ?? 5,
      penalty: params.penalty ?? 1.0,
      scope,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    return ok(record);
  }

  static validateParams(params: Partial<ConstraintCreateParams>): Result<true, ValidationError> {
    if (!params.name || typeof params.name !== "string" || params.name.trim().length === 0) {
      return err(new ValidationError("Constraint name is required and must be a non-empty string", {
        field: "name",
      }));
    }

    if (params.name.length > 256) {
      return err(new ValidationError("Constraint name must not exceed 256 characters", {
        field: "name",
        maxLength: 256,
        actualLength: params.name.length,
      }));
    }

    if (!params.type || !VALID_CONSTRAINT_TYPES.has(params.type)) {
      return err(new ValidationError("Constraint type is required and must be a valid ConstraintType", {
        field: "type",
        validTypes: Object.values(ConstraintType),
      }));
    }

    if (!params.expression || typeof params.expression !== "string" || params.expression.trim().length === 0) {
      return err(new ValidationError("Constraint expression is required and must be a non-empty string", {
        field: "expression",
      }));
    }

    if (params.priority !== undefined) {
      if (typeof params.priority !== "number" || !Number.isInteger(params.priority) || params.priority < 0 || params.priority > 10) {
        return err(new ValidationError("Constraint priority must be an integer between 0 and 10", {
          field: "priority",
          value: params.priority,
        }));
      }
    }

    if (params.penalty !== undefined) {
      if (typeof params.penalty !== "number" || !Number.isFinite(params.penalty) || params.penalty < 0) {
        return err(new ValidationError("Constraint penalty must be a non-negative number", {
          field: "penalty",
          value: params.penalty,
        }));
      }
    }

    if (params.scope !== undefined) {
      if (!Array.isArray(params.scope)) {
        return err(new ValidationError("Constraint scope must be an array of entity IDs", {
          field: "scope",
        }));
      }
      for (const id of params.scope) {
        if (typeof id !== "string" || id.trim().length === 0) {
          return err(new ValidationError("Each scope entry must be a non-empty string", {
            field: "scope",
            invalidEntry: id,
          }));
        }
      }
    }

    return ok(true);
  }

  static validate(record: ConstraintRecord): Result<true, ValidationError> {
    if (!record.id || typeof record.id !== "string") {
      return err(new ValidationError("Constraint id is required and must be a string", {
        field: "id",
      }));
    }

    if (!record.name || typeof record.name !== "string") {
      return err(new ValidationError("Constraint name is required and must be a string", {
        field: "name",
        constraintId: record.id,
      }));
    }

    if (!VALID_CONSTRAINT_TYPES.has(record.constraintType)) {
      return err(new ValidationError("Constraint type must be a valid ConstraintType", {
        field: "constraintType",
        constraintId: record.id,
      }));
    }

    if (!VALID_CONSTRAINT_STATUSES.has(record.status)) {
      return err(new ValidationError("Constraint status must be a valid ConstraintStatus", {
        field: "status",
        constraintId: record.id,
      }));
    }

    if (!record.expression || typeof record.expression !== "string") {
      return err(new ValidationError("Constraint expression is required and must be a string", {
        field: "expression",
        constraintId: record.id,
      }));
    }

    if (typeof record.priority !== "number" || !Number.isInteger(record.priority) || record.priority < 0) {
      return err(new ValidationError("Constraint priority must be a non-negative integer", {
        field: "priority",
        constraintId: record.id,
      }));
    }

    if (!(record.scope instanceof Set)) {
      return err(new ValidationError("Constraint scope must be a Set", {
        field: "scope",
        constraintId: record.id,
      }));
    }

    return ok(true);
  }

  static evaluate(
    record: ConstraintRecord,
    context: Record<string, unknown>
  ): Result<ConstraintStatus, ValidationError> {
    try {
      const tokens = Constraint.tokenize(record.expression);
      const result = Constraint.evaluateTokens(tokens, context);

      if (result) {
        return ok(ConstraintStatus.Satisfied);
      } else {
        if (record.constraintType === ConstraintType.Hard) {
          return ok(ConstraintStatus.Violated);
        }
        return ok(ConstraintStatus.Violated);
      }
    } catch (error) {
      return err(new ValidationError("Failed to evaluate constraint expression", {
        constraintId: record.id,
        expression: record.expression,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  private static tokenize(expression: string): string[] {
    const tokens: string[] = [];
    let current = "";
    let inString = false;

    for (let i = 0; i < expression.length; i++) {
      const ch = expression[i];

      if (ch === '"' || ch === "'") {
        if (inString) {
          tokens.push(current);
          current = "";
          inString = false;
        } else {
          inString = true;
        }
        continue;
      }

      if (inString) {
        current += ch;
        continue;
      }

      if (ch === " " || ch === "\t") {
        if (current.length > 0) {
          tokens.push(current);
          current = "";
        }
        continue;
      }

      if (ch === "(" || ch === ")" || ch === ",") {
        if (current.length > 0) {
          tokens.push(current);
          current = "";
        }
        tokens.push(ch);
        continue;
      }

      current += ch;
    }

    if (current.length > 0) {
      tokens.push(current);
    }

    return tokens;
  }

  private static evaluateTokens(tokens: string[], context: Record<string, unknown>): boolean {
    if (tokens.length === 0) {
      return true;
    }

    const [first, ...rest] = tokens;

    if (first === "AND") {
      return Constraint.evaluateTokens(rest, context);
    }

    if (first === "OR") {
      return Constraint.evaluateTokens(rest, context);
    }

    if (first === "NOT") {
      return !Constraint.evaluateTokens(rest, context);
    }

    if (first.startsWith("(")) {
      const closeIdx = rest.findIndex((t) => t === ")");
      if (closeIdx === -1) {
        return Constraint.evaluateTokens([first.slice(1), ...rest], context);
      }
      const innerTokens = [first.slice(1), ...rest.slice(0, closeIdx)].filter((t) => t.length > 0);
      const innerResult = Constraint.evaluateTokens(innerTokens, context);
      const remaining = rest.slice(closeIdx + 1);
      if (remaining.length > 0) {
        return innerResult && Constraint.evaluateTokens(remaining, context);
      }
      return innerResult;
    }

    if (tokens.length >= 3) {
      const operator = tokens[1];
      const left = Constraint.resolveValue(first, context);
      const right = Constraint.resolveValue(tokens[2], context);

      switch (operator) {
        case "==":
          return left === right;
        case "!=":
          return left !== right;
        case ">":
          return typeof left === "number" && typeof right === "number" && left > right;
        case ">=":
          return typeof left === "number" && typeof right === "number" && left >= right;
        case "<":
          return typeof left === "number" && typeof right === "number" && left < right;
        case "<=":
          return typeof left === "number" && typeof right === "number" && left <= right;
        case "contains":
          if (Array.isArray(left)) return left.includes(right);
          if (typeof left === "string") return left.includes(String(right));
          return false;
        case "in":
          if (Array.isArray(right)) return right.includes(left);
          return false;
      }
    }

    const resolved = Constraint.resolveValue(first, context);
    return !!resolved;
  }

  private static resolveValue(token: string, context: Record<string, unknown>): unknown {
    if (token === "true") return true;
    if (token === "false") return false;
    if (token === "null") return null;

    const num = Number(token);
    if (!isNaN(num) && token.trim() !== "") {
      return num;
    }

    if (token.startsWith("$")) {
      const path = token.slice(1).split(".");
      let current: unknown = context;
      for (const segment of path) {
        if (current === null || current === undefined || typeof current !== "object") {
          return undefined;
        }
        current = (current as Record<string, unknown>)[segment];
      }
      return current;
    }

    return token;
  }

  static detectConflicts(constraints: ConstraintRecord[]): ConstraintConflict[] {
    const conflicts: ConstraintConflict[] = [];

    for (let i = 0; i < constraints.length; i++) {
      for (let j = i + 1; j < constraints.length; j++) {
        const a = constraints[i];
        const b = constraints[j];

        const scopeOverlap = Constraint.hasScopeOverlap(a, b);
        if (!scopeOverlap) continue;

        const expressionConflict = Constraint.areExpressionsConflicting(a.expression, b.expression);
        if (expressionConflict) {
          const severity = (a.constraintType === ConstraintType.Hard && b.constraintType === ConstraintType.Hard)
            ? "high"
            : (a.constraintType === ConstraintType.Hard || b.constraintType === ConstraintType.Hard)
              ? "medium"
              : "low";

          conflicts.push({
            constraintA: a.id,
            constraintB: b.id,
            description: `Constraints "${a.name}" and "${b.name}" have conflicting requirements`,
            severity,
          });
        }
      }
    }

    return conflicts;
  }

  private static hasScopeOverlap(a: ConstraintRecord, b: ConstraintRecord): boolean {
    if (a.scope.size === 0 || b.scope.size === 0) {
      return true;
    }

    for (const entityId of a.scope) {
      if (b.scope.has(entityId)) {
        return true;
      }
    }

    return false;
  }

  private static areExpressionsConflicting(exprA: string, exprB: string): boolean {
    const negationPatterns = [
      { a: "==", b: "!=" },
      { a: ">", b: "<=" },
      { a: ">=", b: "<" },
      { a: "<", b: ">=" },
      { a: "<=", b: ">" },
    ];

    for (const pattern of negationPatterns) {
      if (exprA.includes(pattern.a) && exprB.includes(pattern.b)) {
        const leftA = exprA.split(pattern.a)[0]?.trim();
        const leftB = exprB.split(pattern.b)[0]?.trim();
        if (leftA && leftB && leftA === leftB) {
          return true;
        }
      }
      if (exprA.includes(pattern.b) && exprB.includes(pattern.a)) {
        const leftA = exprA.split(pattern.b)[0]?.trim();
        const leftB = exprB.split(pattern.a)[0]?.trim();
        if (leftA && leftB && leftA === leftB) {
          return true;
        }
      }
    }

    return false;
  }

  static serialize(record: ConstraintRecord): Record<string, unknown> {
    return {
      id: record.id,
      name: record.name,
      constraintType: record.constraintType,
      status: record.status,
      description: record.description,
      expression: record.expression,
      priority: record.priority,
      penalty: record.penalty,
      scope: Array.from(record.scope),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    };
  }

  static deserialize(data: Record<string, unknown>): Result<ConstraintRecord, ValidationError> {
    if (!data || typeof data !== "object") {
      return err(new ValidationError("Constraint data must be a non-null object"));
    }

    if (!data.id || typeof data.id !== "string") {
      return err(new ValidationError("Constraint data must contain a string 'id' field"));
    }

    const scope = new Set<string>();
    if (Array.isArray(data.scope)) {
      for (const id of data.scope) {
        if (typeof id === "string") {
          scope.add(id);
        }
      }
    }

    const record: ConstraintRecord = {
      id: data.id as string,
      name: (data.name as string) ?? "",
      constraintType: (data.constraintType as ConstraintType) ?? ConstraintType.Logical,
      status: (data.status as ConstraintStatus) ?? ConstraintStatus.Active,
      description: (data.description as string) ?? "",
      expression: (data.expression as string) ?? "",
      priority: (data.priority as number) ?? 5,
      penalty: (data.penalty as number) ?? 1.0,
      scope,
      createdAt: (data.createdAt as string) ?? new Date().toISOString(),
      updatedAt: (data.updatedAt as string) ?? new Date().toISOString(),
      version: (data.version as number) ?? 1,
    };

    const validation = Constraint.validate(record);
    if (!validation.ok) {
      return validation;
    }

    return ok(record);
  }
}
