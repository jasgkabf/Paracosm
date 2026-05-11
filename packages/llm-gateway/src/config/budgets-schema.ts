import type { BudgetConfig } from '@paracosm/shared';
import { isPositiveNumber } from '@paracosm/shared';

export interface BudgetValidationResult {
  valid: boolean;
  errors: string[];
}

export class BudgetsSchema {
  static validate(budget: BudgetConfig): BudgetValidationResult {
    const errors: string[] = [];

    if (budget.dailyLimit !== undefined) {
      if (!isPositiveNumber(budget.dailyLimit)) {
        errors.push('dailyLimit must be a positive number');
      }
    }

    if (budget.monthlyLimit !== undefined) {
      if (!isPositiveNumber(budget.monthlyLimit)) {
        errors.push('monthlyLimit must be a positive number');
      }
    }

    if (budget.perRequestLimit !== undefined) {
      if (!isPositiveNumber(budget.perRequestLimit)) {
        errors.push('perRequestLimit must be a positive number');
      }
    }

    if (budget.alertThreshold !== undefined) {
      if (typeof budget.alertThreshold !== 'number' || budget.alertThreshold < 0 || budget.alertThreshold > 1) {
        errors.push('alertThreshold must be a number between 0 and 1');
      }
    }

    if (budget.dailyLimit !== undefined && budget.monthlyLimit !== undefined) {
      if (budget.dailyLimit > budget.monthlyLimit) {
        errors.push('dailyLimit cannot exceed monthlyLimit');
      }
    }

    if (budget.perRequestLimit !== undefined && budget.dailyLimit !== undefined) {
      if (budget.perRequestLimit > budget.dailyLimit) {
        errors.push('perRequestLimit cannot exceed dailyLimit');
      }
    }

    if (budget.currency !== undefined) {
      const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CNY'];
      if (!validCurrencies.includes(budget.currency)) {
        errors.push(`currency must be one of: ${validCurrencies.join(', ')}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  static getDefaults(): BudgetConfig {
    return {
      dailyLimit: 10,
      monthlyLimit: 100,
      perRequestLimit: 1,
      alertThreshold: 0.8,
      currency: 'USD',
    };
  }

  static calculateDailySpend(usage: Array<{ cost: number; timestamp: Date }>): number {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return usage
      .filter((u) => u.timestamp >= startOfDay)
      .reduce((sum, u) => sum + u.cost, 0);
  }

  static calculateMonthlySpend(usage: Array<{ cost: number; timestamp: Date }>): number {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return usage
      .filter((u) => u.timestamp >= startOfMonth)
      .reduce((sum, u) => sum + u.cost, 0);
  }

  static isWithinBudget(
    cost: number,
    budget: BudgetConfig,
    dailySpend: number,
    monthlySpend: number,
  ): { allowed: boolean; reason?: string } {
    if (budget.perRequestLimit && cost > budget.perRequestLimit) {
      return {
        allowed: false,
        reason: `Request cost $${cost.toFixed(4)} exceeds per-request limit $${budget.perRequestLimit}`,
      };
    }

    if (budget.dailyLimit && dailySpend + cost > budget.dailyLimit) {
      return {
        allowed: false,
        reason: `Daily spend would exceed limit ($${(dailySpend + cost).toFixed(4)} > $${budget.dailyLimit})`,
      };
    }

    if (budget.monthlyLimit && monthlySpend + cost > budget.monthlyLimit) {
      return {
        allowed: false,
        reason: `Monthly spend would exceed limit ($${(monthlySpend + cost).toFixed(4)} > $${budget.monthlyLimit})`,
      };
    }

    return { allowed: true };
  }

  static getBudgetUtilization(
    budget: BudgetConfig,
    dailySpend: number,
    monthlySpend: number,
  ): { daily: number; monthly: number; status: 'ok' | 'warning' | 'critical' } {
    const daily = budget.dailyLimit ? dailySpend / budget.dailyLimit : 0;
    const monthly = budget.monthlyLimit ? monthlySpend / budget.monthlyLimit : 0;
    const maxUtil = Math.max(daily, monthly);

    let status: 'ok' | 'warning' | 'critical' = 'ok';
    if (maxUtil >= 0.95) {
      status = 'critical';
    } else if (maxUtil >= budget.alertThreshold) {
      status = 'warning';
    }

    return { daily, monthly, status };
  }
}

export function validateBudgetsConfig(budget: BudgetConfig): BudgetValidationResult {
  return BudgetsSchema.validate(budget);
}
