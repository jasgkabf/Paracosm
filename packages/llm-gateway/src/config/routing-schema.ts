import type { RoutingRule } from '@paracosm/shared';
import { isNonEmptyString } from '@paracosm/shared';

export interface RoutingValidationResult {
  valid: boolean;
  errors: string[];
}

export interface RoutingConfig {
  strategy: string;
  rules: RoutingRule[];
}

const VALID_STRATEGIES = [
  'round_robin',
  'least_latency',
  'cost_optimized',
  'quality_optimized',
  'adaptive',
  'manual',
];

export class RoutingSchema {
  static validate(config: RoutingConfig): RoutingValidationResult {
    const errors: string[] = [];

    if (!isNonEmptyString(config.strategy)) {
      errors.push('Routing strategy is required');
    } else if (!VALID_STRATEGIES.includes(config.strategy)) {
      errors.push(
        `Invalid routing strategy '${config.strategy}'. Valid: ${VALID_STRATEGIES.join(', ')}`,
      );
    }

    if (!Array.isArray(config.rules)) {
      errors.push('Routing rules must be an array');
      return { valid: false, errors };
    }

    const ruleIds = new Set<string>();

    for (let i = 0; i < config.rules.length; i++) {
      const rule = config.rules[i];
      const prefix = `Rule[${i}]`;

      if (!isNonEmptyString(rule.id)) {
        errors.push(`${prefix}: rule id is required`);
      } else {
        if (ruleIds.has(rule.id)) {
          errors.push(`${prefix}: duplicate rule id '${rule.id}'`);
        }
        ruleIds.add(rule.id);
      }

      if (!isNonEmptyString(rule.name)) {
        errors.push(`${prefix}: rule name is required`);
      }

      if (!isNonEmptyString(rule.condition)) {
        errors.push(`${prefix}: rule condition is required`);
      } else {
        const conditionError = this.validateCondition(rule.condition);
        if (conditionError) {
          errors.push(`${prefix}: ${conditionError}`);
        }
      }

      if (!isNonEmptyString(rule.provider)) {
        errors.push(`${prefix}: rule provider is required`);
      }

      if (!isNonEmptyString(rule.model)) {
        errors.push(`${prefix}: rule model is required`);
      }

      if (typeof rule.priority !== 'number' || rule.priority < 1 || !Number.isInteger(rule.priority)) {
        errors.push(`${prefix}: priority must be a positive integer`);
      }

      if (typeof rule.enabled !== 'boolean') {
        errors.push(`${prefix}: enabled must be a boolean`);
      }
    }

    const enabledRules = config.rules.filter((r) => r.enabled);
    if (config.strategy === 'manual' && enabledRules.length === 0) {
      errors.push('Manual routing requires at least one enabled rule');
    }

    const sortedPriorities = enabledRules
      .map((r) => r.priority)
      .sort((a, b) => a - b);
    for (let i = 1; i < sortedPriorities.length; i++) {
      if (sortedPriorities[i] === sortedPriorities[i - 1]) {
        errors.push(
          `Multiple enabled rules share priority ${sortedPriorities[i]}`,
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private static validateCondition(condition: string): string | null {
    const validOperators = ['===', '!==', '>', '<', '>=', '<=', '&&', '||', 'includes', 'startsWith', 'endsWith'];
    const hasValidOperator = validOperators.some((op) => condition.includes(op));
    const isBoolean = condition === 'true' || condition === 'false';
    const hasFieldAccess = condition.includes('taskType') || condition.includes('provider') || condition.includes('model') || condition.includes('tokenCount') || condition.includes('priority');

    if (!hasValidOperator && !isBoolean && !hasFieldAccess) {
      return `Condition '${condition}' does not appear to contain a valid expression`;
    }

    const dangerousPatterns = [
      /import\s/,
      /require\s*\(/,
      /eval\s*\(/,
      /Function\s*\(/,
      /process\./,
      /child_process/,
      /fs\./,
      /__dirname/,
      /__filename/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(condition)) {
        return `Condition contains disallowed pattern: ${pattern.source}`;
      }
    }

    return null;
  }

  static getDefaultRules(): RoutingRule[] {
    return [
      {
        id: 'rule-code-gen',
        name: 'Code Generation',
        condition: 'taskType === "code_generation"',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        priority: 1,
        enabled: true,
        metadata: {},
      },
      {
        id: 'rule-analysis',
        name: 'Analysis',
        condition: 'taskType === "analysis"',
        provider: 'openai',
        model: 'gpt-4o',
        priority: 1,
        enabled: true,
        metadata: {},
      },
      {
        id: 'rule-chat',
        name: 'Chat',
        condition: 'taskType === "chat"',
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        priority: 1,
        enabled: true,
        metadata: {},
      },
      {
        id: 'rule-fallback',
        name: 'Default Fallback',
        condition: 'true',
        provider: 'openai',
        model: 'gpt-4o-mini',
        priority: 99,
        enabled: true,
        metadata: {},
      },
    ];
  }
}

export function validateRoutingConfig(config: RoutingConfig): RoutingValidationResult {
  return RoutingSchema.validate(config);
}
