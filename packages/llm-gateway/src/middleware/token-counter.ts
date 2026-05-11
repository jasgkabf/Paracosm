import type { TokenUsage } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';
import type { Middleware, MiddlewareContext } from './middleware-pipeline.js';

const logger = createLogger('TokenCounter');

export interface TokenCountRecord {
  requestId: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  timestamp: number;
  costEstimate: number;
}

export interface TokenBudget {
  dailyLimit: number;
  monthlyLimit: number;
  dailyUsed: number;
  monthlyUsed: number;
  alertThreshold: number;
  alerted: boolean;
}

export interface TokenAlert {
  type: 'daily_warning' | 'daily_exceeded' | 'monthly_warning' | 'monthly_exceeded';
  currentUsage: number;
  limit: number;
  percentage: number;
  timestamp: number;
}

export class TokenCounter implements Middleware {
  name = 'token-counter';
  order = 10;

  private records: TokenCountRecord[] = [];
  private maxRecords: number = 10000;
  private totalsByProvider: Map<string, number> = new Map();
  private totalsByModel: Map<string, number> = new Map();
  private dailyTotals: Map<string, number> = new Map();
  private hourlyTotals: Map<string, number> = new Map();
  private budget: TokenBudget;
  private alerts: TokenAlert[] = [];
  private maxAlerts: number = 100;
  private alertCallbacks: Array<(alert: TokenAlert) => void> = [];
  private costPerToken: Map<string, { input: number; output: number }> = new Map();

  constructor(budget?: Partial<TokenBudget>) {
    this.budget = {
      dailyLimit: budget?.dailyLimit ?? 500000,
      monthlyLimit: budget?.monthlyLimit ?? 10000000,
      dailyUsed: 0,
      monthlyUsed: 0,
      alertThreshold: budget?.alertThreshold ?? 0.8,
      alerted: false,
    };

    this.costPerToken.set('gpt-4o', { input: 0.000005, output: 0.000015 });
    this.costPerToken.set('gpt-4-turbo', { input: 0.00001, output: 0.00003 });
    this.costPerToken.set('gpt-3.5-turbo', { input: 0.0000005, output: 0.0000015 });
    this.costPerToken.set('claude-3-opus-20240229', { input: 0.000015, output: 0.000075 });
    this.costPerToken.set('claude-3-5-sonnet-20241022', { input: 0.000003, output: 0.000015 });
    this.costPerToken.set('claude-3-haiku-20240307', { input: 0.00000025, output: 0.00000125 });
    this.costPerToken.set('gemini-1.5-pro', { input: 0.0000035, output: 0.0000105 });
    this.costPerToken.set('gemini-1.5-flash', { input: 0.00000035, output: 0.00000105 });
  }

  async beforeRequest(context: MiddlewareContext): Promise<MiddlewareContext> {
    const dailyTotal = this.getTodayTotal();
    const monthlyTotal = this.getMonthlyTotal();

    if (dailyTotal >= this.budget.dailyLimit) {
      logger.warn('Daily token budget exceeded', {
        used: dailyTotal,
        limit: this.budget.dailyLimit,
      });
      this.fireAlert({
        type: 'daily_exceeded',
        currentUsage: dailyTotal,
        limit: this.budget.dailyLimit,
        percentage: (dailyTotal / this.budget.dailyLimit) * 100,
        timestamp: Date.now(),
      });
    }

    if (monthlyTotal >= this.budget.monthlyLimit) {
      logger.warn('Monthly token budget exceeded', {
        used: monthlyTotal,
        limit: this.budget.monthlyLimit,
      });
      this.fireAlert({
        type: 'monthly_exceeded',
        currentUsage: monthlyTotal,
        limit: this.budget.monthlyLimit,
        percentage: (monthlyTotal / this.budget.monthlyLimit) * 100,
        timestamp: Date.now(),
      });
    }

    context.metadata.tokenBudgetRemaining = this.budget.dailyLimit - dailyTotal;
    return context;
  }

  async afterResponse(context: MiddlewareContext): Promise<MiddlewareContext> {
    if (!context.response) return context;

    const { response } = context;
    const costEstimate = this.estimateCost(response.model, response.usage);
    const record: TokenCountRecord = {
      requestId: response.requestId,
      provider: response.provider,
      model: response.model,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      totalTokens: response.usage.totalTokens,
      timestamp: Date.now(),
      costEstimate,
    };

    this.records.push(record);
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }

    this.totalsByProvider.set(
      response.provider,
      (this.totalsByProvider.get(response.provider) ?? 0) + response.usage.totalTokens,
    );

    this.totalsByModel.set(
      response.model,
      (this.totalsByModel.get(response.model) ?? 0) + response.usage.totalTokens,
    );

    const today = new Date().toISOString().split('T')[0];
    this.dailyTotals.set(
      today,
      (this.dailyTotals.get(today) ?? 0) + response.usage.totalTokens,
    );

    const hourKey = `${today}T${new Date().getHours().toString().padStart(2, '0')}`;
    this.hourlyTotals.set(
      hourKey,
      (this.hourlyTotals.get(hourKey) ?? 0) + response.usage.totalTokens,
    );

    this.budget.dailyUsed = this.getTodayTotal();
    this.budget.monthlyUsed = this.getMonthlyTotal();

    this.checkBudgetAlerts();

    return context;
  }

  count(text: string): number {
    let tokenCount = 0;
    const words = text.split(/\s+/);
    for (const word of words) {
      if (word.length === 0) continue;
      const cjkChars = word.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g);
      const cjkCount = cjkChars ? cjkChars.length : 0;
      const nonCjkLength = word.length - cjkCount;
      tokenCount += Math.ceil(nonCjkLength / 4) + cjkCount;
    }
    return Math.max(1, tokenCount);
  }

  track(requestId: string, usage: TokenUsage): TokenCountRecord {
    const today = new Date().toISOString().split('T')[0];
    const record: TokenCountRecord = {
      requestId,
      provider: 'unknown',
      model: 'unknown',
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      timestamp: Date.now(),
      costEstimate: 0,
    };

    this.records.push(record);
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }

    this.dailyTotals.set(
      today,
      (this.dailyTotals.get(today) ?? 0) + usage.totalTokens,
    );

    return record;
  }

  budgetCheck(): { allowed: boolean; reason?: string } {
    const dailyTotal = this.getTodayTotal();
    const monthlyTotal = this.getMonthlyTotal();

    if (dailyTotal >= this.budget.dailyLimit) {
      return { allowed: false, reason: 'Daily token budget exceeded' };
    }
    if (monthlyTotal >= this.budget.monthlyLimit) {
      return { allowed: false, reason: 'Monthly token budget exceeded' };
    }
    return { allowed: true };
  }

  alert(callback: (alert: TokenAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  getBudget(): TokenBudget {
    return { ...this.budget };
  }

  setBudget(updates: Partial<TokenBudget>): void {
    this.budget = { ...this.budget, ...updates };
  }

  getTotalTokens(): number {
    let total = 0;
    for (const count of this.totalsByProvider.values()) {
      total += count;
    }
    return total;
  }

  getTokensByProvider(): Record<string, number> {
    return Object.fromEntries(this.totalsByProvider);
  }

  getTokensByModel(): Record<string, number> {
    return Object.fromEntries(this.totalsByModel);
  }

  getDailyTotals(): Record<string, number> {
    return Object.fromEntries(this.dailyTotals);
  }

  getHourlyTotals(): Record<string, number> {
    return Object.fromEntries(this.hourlyTotals);
  }

  getTodayTotal(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.dailyTotals.get(today) ?? 0;
  }

  getMonthlyTotal(): number {
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    let total = 0;
    for (const [key, value] of this.dailyTotals) {
      if (key.startsWith(monthPrefix)) {
        total += value;
      }
    }
    return total;
  }

  getRecentRecords(count: number = 100): TokenCountRecord[] {
    return this.records.slice(-count);
  }

  getAverageTokensPerRequest(): number {
    if (this.records.length === 0) return 0;
    const total = this.records.reduce((sum, r) => sum + r.totalTokens, 0);
    return total / this.records.length;
  }

  getAlerts(): TokenAlert[] {
    return [...this.alerts];
  }

  getEstimatedCost(): number {
    return this.records.reduce((sum, r) => sum + r.costEstimate, 0);
  }

  resetDaily(): void {
    const today = new Date().toISOString().split('T')[0];
    this.dailyTotals.delete(today);
    this.budget.dailyUsed = 0;
    this.budget.alerted = false;
  }

  resetMonthly(): void {
    this.dailyTotals.clear();
    this.budget.monthlyUsed = 0;
    this.budget.dailyUsed = 0;
    this.budget.alerted = false;
  }

  clear(): void {
    this.records = [];
    this.totalsByProvider.clear();
    this.totalsByModel.clear();
    this.dailyTotals.clear();
    this.hourlyTotals.clear();
    this.alerts = [];
    this.budget.dailyUsed = 0;
    this.budget.monthlyUsed = 0;
    this.budget.alerted = false;
  }

  private estimateCost(model: string, usage: TokenUsage): number {
    const pricing = this.costPerToken.get(model);
    if (!pricing) return 0;
    return (usage.promptTokens * pricing.input) + (usage.completionTokens * pricing.output);
  }

  private checkBudgetAlerts(): void {
    const dailyPercentage = this.budget.dailyUsed / this.budget.dailyLimit;
    const monthlyPercentage = this.budget.monthlyUsed / this.budget.monthlyLimit;

    if (dailyPercentage >= this.budget.alertThreshold && !this.budget.alerted) {
      this.fireAlert({
        type: 'daily_warning',
        currentUsage: this.budget.dailyUsed,
        limit: this.budget.dailyLimit,
        percentage: dailyPercentage * 100,
        timestamp: Date.now(),
      });
    }

    if (monthlyPercentage >= this.budget.alertThreshold) {
      this.fireAlert({
        type: 'monthly_warning',
        currentUsage: this.budget.monthlyUsed,
        limit: this.budget.monthlyLimit,
        percentage: monthlyPercentage * 100,
        timestamp: Date.now(),
      });
    }
  }

  private fireAlert(alert: TokenAlert): void {
    this.alerts.push(alert);
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-this.maxAlerts);
    }
    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (error) {
        logger.error('Alert callback error', { error: (error as Error).message });
      }
    }
  }
}
