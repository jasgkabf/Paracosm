import type { RoutingRule } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';
import type { RoutingContext } from './smart-router.js';

const logger = createLogger('RoutingRules');

export interface RuleMatchResult {
  matched: boolean;
  rule?: RoutingRule;
  evaluatedConditions: Array<{ ruleId: string; condition: string; result: boolean }>;
}

export class RoutingRules {
  private rules: RoutingRule[];

  constructor(rules: RoutingRule[]) {
    this.rules = [...rules].sort((a, b) => a.priority - b.priority);
  }

  match(context: RoutingContext): RoutingRule | null {
    const enabledRules = this.rules.filter((r) => r.enabled);

    for (const rule of enabledRules) {
      if (this.evaluateCondition(rule.condition, context)) {
        logger.debug('Rule matched', { ruleId: rule.id, ruleName: rule.name });
        return rule;
      }
    }

    return null;
  }

  matchAll(context: RoutingContext): RoutingRule[] {
    const enabledRules = this.rules.filter((r) => r.enabled);
    return enabledRules.filter((rule) => this.evaluateCondition(rule.condition, context));
  }

  matchDetailed(context: RoutingContext): RuleMatchResult {
    const enabledRules = this.rules.filter((r) => r.enabled);
    const evaluatedConditions: Array<{ ruleId: string; condition: string; result: boolean }> = [];

    for (const rule of enabledRules) {
      const result = this.evaluateCondition(rule.condition, context);
      evaluatedConditions.push({
        ruleId: rule.id,
        condition: rule.condition,
        result,
      });

      if (result) {
        return { matched: true, rule, evaluatedConditions };
      }
    }

    return { matched: false, evaluatedConditions };
  }

  addRule(rule: RoutingRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index === -1) return false;
    this.rules.splice(index, 1);
    return true;
  }

  updateRule(ruleId: string, updates: Partial<RoutingRule>): boolean {
    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index === -1) return false;
    this.rules[index] = { ...this.rules[index], ...updates, id: ruleId };
    this.rules.sort((a, b) => a.priority - b.priority);
    return true;
  }

  getRules(): RoutingRule[] {
    return [...this.rules];
  }

  getEnabledRules(): RoutingRule[] {
    return this.rules.filter((r) => r.enabled);
  }

  getRuleById(ruleId: string): RoutingRule | undefined {
    return this.rules.find((r) => r.id === ruleId);
  }

  private evaluateCondition(condition: string, context: RoutingContext): boolean {
    if (condition === 'true') return true;
    if (condition === 'false') return false;

    try {
      const contextObj: Record<string, unknown> = {
        taskType: context.taskType,
        promptTokens: context.promptTokens,
        maxTokens: context.maxTokens,
        priority: context.priority,
        requiresStreaming: context.requiresStreaming,
        requiresVision: context.requiresVision,
        requiresFunctionCalling: context.requiresFunctionCalling,
        budgetRemaining: context.budgetRemaining,
      };

      return this.safeEvaluate(condition, contextObj);
    } catch (error) {
      logger.warn('Failed to evaluate condition', {
        condition,
        error: (error as Error).message,
      });
      return false;
    }
  }

  private safeEvaluate(condition: string, context: Record<string, unknown>): boolean {
    const tokens = this.tokenize(condition);
    return this.evaluateTokens(tokens, context);
  }

  private tokenize(condition: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inString = false;

    for (let i = 0; i < condition.length; i++) {
      const char = condition[i];

      if (char === '"' || char === "'") {
        inString = !inString;
        current += char;
        continue;
      }

      if (inString) {
        current += char;
        continue;
      }

      if (char === ' ' || char === '\t') {
        if (current) {
          tokens.push(current);
          current = '';
        }
        continue;
      }

      if (char === '=' && condition[i + 1] === '=') {
        if (current) {
          tokens.push(current);
          current = '';
        }
        tokens.push('===');
        i++;
        continue;
      }

      if (char === '!' && condition[i + 1] === '=') {
        if (current) {
          tokens.push(current);
          current = '';
        }
        tokens.push('!==');
        i++;
        continue;
      }

      if (char === '>' && condition[i + 1] === '=') {
        if (current) {
          tokens.push(current);
          current = '';
        }
        tokens.push('>=');
        i++;
        continue;
      }

      if (char === '<' && condition[i + 1] === '=') {
        if (current) {
          tokens.push(current);
          current = '';
        }
        tokens.push('<=');
        i++;
        continue;
      }

      if (char === '>' || char === '<') {
        if (current) {
          tokens.push(current);
          current = '';
        }
        tokens.push(char);
        continue;
      }

      if (char === '&' && condition[i + 1] === '&') {
        if (current) {
          tokens.push(current);
          current = '';
        }
        tokens.push('&&');
        i++;
        continue;
      }

      if (char === '|' && condition[i + 1] === '|') {
        if (current) {
          tokens.push(current);
          current = '';
        }
        tokens.push('||');
        i++;
        continue;
      }

      current += char;
    }

    if (current) {
      tokens.push(current);
    }

    return tokens;
  }

  private evaluateTokens(tokens: string[], context: Record<string, unknown>): boolean {
    if (tokens.length === 0) return false;
    if (tokens.length === 1) {
      return this.resolveValue(tokens[0], context) === true;
    }

    let result = this.evaluateSimpleExpression(tokens.slice(0, 3), context);

    let i = 3;
    while (i < tokens.length) {
      const operator = tokens[i];
      if (operator === '&&') {
        i++;
        const rightTokens = tokens.slice(i, i + 3);
        const right = this.evaluateSimpleExpression(rightTokens, context);
        result = result && right;
        i += 3;
      } else if (operator === '||') {
        i++;
        const rightTokens = tokens.slice(i, i + 3);
        const right = this.evaluateSimpleExpression(rightTokens, context);
        result = result || right;
        i += 3;
      } else {
        i++;
      }
    }

    return result;
  }

  private evaluateSimpleExpression(tokens: string[], context: Record<string, unknown>): boolean {
    if (tokens.length < 3) {
      if (tokens.length === 1) {
        const val = this.resolveValue(tokens[0], context);
        return val === true || val === 'true';
      }
      return false;
    }

    const left = this.resolveValue(tokens[0], context);
    const operator = tokens[1];
    const right = this.resolveValue(tokens[2], context);

    switch (operator) {
      case '===':
        return left === right;
      case '!==':
        return left !== right;
      case '>':
        return Number(left) > Number(right);
      case '<':
        return Number(left) < Number(right);
      case '>=':
        return Number(left) >= Number(right);
      case '<=':
        return Number(left) <= Number(right);
      default:
        return false;
    }
  }

  private resolveValue(token: string, context: Record<string, unknown>): unknown {
    if (token.startsWith('"') || token.startsWith("'")) {
      return token.slice(1, -1);
    }

    if (token === 'true') return true;
    if (token === 'false') return false;

    if (/^-?\d+(\.\d+)?$/.test(token)) {
      return Number(token);
    }

    if (token in context) {
      return context[token];
    }

    const dotIndex = token.indexOf('.');
    if (dotIndex > 0) {
      const objKey = token.substring(0, dotIndex);
      const propKey = token.substring(dotIndex + 1);
      const obj = context[objKey];
      if (obj && typeof obj === 'object') {
        return (obj as Record<string, unknown>)[propKey];
      }
    }

    return token;
  }
}
