import { createLogger } from '@paracosm/shared';
import type { Middleware, MiddlewareContext } from './middleware-pipeline.js';

const logger = createLogger('BudgetGuard');

export interface BudgetEntry {
  provider: string;
  model: string;
  cost: number;
  tokens: number;
  timestamp: number;
  requestId: string;
}

export interface BudgetLimits {
  dailyLimit: number;
  monthlyLimit: number;
  perRequestLimit: number;
  alertThreshold: number;
  blockThreshold: number;
  currency: string;
}

export interface BudgetStatus {
  dailySpent: number;
  dailyLimit: number;
  dailyRemaining: number;
  dailyPercentage: number;
  monthlySpent: number;
  monthlyLimit: number;
  monthlyRemaining: number;
  monthlyPercentage: number;
  isBlocked: boolean;
  isAlertTriggered: boolean;
}

export interface BudgetAlert {
  type: 'warning' | 'exceeded' | 'blocked';
  scope: 'daily' | 'monthly' | 'per_request';
  current: number;
  limit: number;
  percentage: number;
  timestamp: number;
}

export class BudgetGuard implements Middleware {
  name = 'budget-guard';
  order = 3;

  private limits: BudgetLimits;
  private dailyEntries: BudgetEntry[] = [];
  private monthlyEntries: BudgetEntry[] = [];
  private alerts: BudgetAlert[] = [];
  private maxAlerts: number = 100;
  private alertCallbacks: Array<(alert: BudgetAlert) => void> = [];
  private blocked: boolean = false;
  private costPerToken: Map<string, { input: number; output: number }> = new Map();
  private dailyResetHour: number = 0;
  private monthlyResetDay: number = 1;
  private lastDailyReset: number = 0;
  private lastMonthlyReset: number = 0;

  constructor(limits?: Partial<BudgetLimits>) {
    this.limits = {
      dailyLimit: limits?.dailyLimit ?? 10,
      monthlyLimit: limits?.monthlyLimit ?? 100,
      perRequestLimit: limits?.perRequestLimit ?? 1,
      alertThreshold: limits?.alertThreshold ?? 0.8,
      blockThreshold: limits?.blockThreshold ?? 1.0,
      currency: limits?.currency ?? 'USD',
    };

    this.costPerToken.set('gpt-4o', { input: 0.000005, output: 0.000015 });
    this.costPerToken.set('gpt-4-turbo', { input: 0.00001, output: 0.00003 });
    this.costPerToken.set('gpt-3.5-turbo', { input: 0.0000005, output: 0.0000015 });
    this.costPerToken.set('claude-3-opus-20240229', { input: 0.000015, output: 0.000075 });
    this.costPerToken.set('claude-3-5-sonnet-20241022', { input: 0.000003, output: 0.000015 });
    this.costPerToken.set('claude-3-haiku-20240307', { input: 0.00000025, output: 0.00000125 });
    this.costPerToken.set('gemini-1.5-pro', { input: 0.0000035, output: 0.0000105 });
    this.costPerToken.set('gemini-1.5-flash', { input: 0.00000035, output: 0.00000105 });

    this.checkResets();
  }

  async beforeRequest(context: MiddlewareContext): Promise<MiddlewareContext> {
    this.checkResets();

    const status = this.getStatus();

    if (this.blocked || status.isBlocked) {
      logger.warn('Request blocked by budget guard', {
        dailySpent: status.dailySpent,
        monthlySpent: status.monthlySpent,
      });
      context.aborted = true;
      context.abortReason = 'Budget limit exceeded. Request blocked.';
      context.metadata.budgetBlocked = true;
      return context;
    }

    const estimatedCost = this.estimateRequestCost(
      context.request.model,
      context.request.prompt.length,
      context.request.maxTokens ?? 4096,
    );

    if (estimatedCost > this.limits.perRequestLimit) {
      logger.warn('Request exceeds per-request budget', {
        estimatedCost,
        perRequestLimit: this.limits.perRequestLimit,
      });
      context.aborted = true;
      context.abortReason = `Estimated cost $${estimatedCost.toFixed(6)} exceeds per-request limit $${this.limits.perRequestLimit}`;
      context.metadata.budgetBlocked = true;
      return context;
    }

    context.metadata.estimatedCost = estimatedCost;
    context.metadata.budgetStatus = status;
    return context;
  }

  async afterResponse(context: MiddlewareContext): Promise<MiddlewareContext> {
    if (!context.response) return context;

    const cost = this.deduct(
      context.response.requestId,
      context.response.provider,
      context.response.model,
      context.response.usage.promptTokens,
      context.response.usage.completionTokens,
    );

    context.metadata.actualCost = cost;

    const status = this.getStatus();
    if (status.isAlertTriggered && !context.metadata.budgetAlertFired) {
      this.fireAlert({
        type: 'warning',
        scope: status.dailyPercentage >= this.limits.alertThreshold ? 'daily' : 'monthly',
        current: status.dailyPercentage >= this.limits.alertThreshold ? status.dailySpent : status.monthlySpent,
        limit: status.dailyPercentage >= this.limits.alertThreshold ? status.dailyLimit : status.monthlyLimit,
        percentage: status.dailyPercentage >= this.limits.alertThreshold ? status.dailyPercentage : status.monthlyPercentage,
        timestamp: Date.now(),
      });
      context.metadata.budgetAlertFired = true;
    }

    if (status.isBlocked && !this.blocked) {
      this.blocked = true;
      this.fireAlert({
        type: 'blocked',
        scope: status.dailyPercentage >= this.limits.blockThreshold ? 'daily' : 'monthly',
        current: status.dailyPercentage >= this.limits.blockThreshold ? status.dailySpent : status.monthlySpent,
        limit: status.dailyPercentage >= this.limits.blockThreshold ? status.dailyLimit : status.monthlyLimit,
        percentage: status.dailyPercentage >= this.limits.blockThreshold ? status.dailyPercentage : status.monthlyPercentage,
        timestamp: Date.now(),
      });
    }

    return context;
  }

  check(): BudgetStatus {
    this.checkResets();
    return this.getStatus();
  }

  deduct(
    requestId: string,
    provider: string,
    model: string,
    promptTokens: number,
    completionTokens: number,
  ): number {
    const cost = this.calculateCost(model, promptTokens, completionTokens);

    const entry: BudgetEntry = {
      provider,
      model,
      cost,
      tokens: promptTokens + completionTokens,
      timestamp: Date.now(),
      requestId,
    };

    this.dailyEntries.push(entry);
    this.monthlyEntries.push(entry);

    this.pruneOldEntries();

    logger.info('Budget deducted', {
      requestId,
      provider,
      model,
      cost: cost.toFixed(6),
      tokens: entry.tokens,
    });

    return cost;
  }

  alert(callback: (alert: BudgetAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  block(): void {
    this.blocked = true;
    logger.warn('Budget guard manually blocked');
  }

  unblock(): void {
    this.blocked = false;
    logger.info('Budget guard manually unblocked');
  }

  dailyReset(): void {
    this.dailyEntries = [];
    this.lastDailyReset = Date.now();
    logger.info('Daily budget reset');
  }

  monthlyReset(): void {
    this.monthlyEntries = [];
    this.lastMonthlyReset = Date.now();
    logger.info('Monthly budget reset');
  }

  getStatus(): BudgetStatus {
    const dailySpent = this.dailyEntries.reduce((sum, e) => sum + e.cost, 0);
    const monthlySpent = this.monthlyEntries.reduce((sum, e) => sum + e.cost, 0);
    const dailyPercentage = this.limits.dailyLimit > 0 ? dailySpent / this.limits.dailyLimit : 0;
    const monthlyPercentage = this.limits.monthlyLimit > 0 ? monthlySpent / this.limits.monthlyLimit : 0;

    return {
      dailySpent,
      dailyLimit: this.limits.dailyLimit,
      dailyRemaining: Math.max(0, this.limits.dailyLimit - dailySpent),
      dailyPercentage,
      monthlySpent,
      monthlyLimit: this.limits.monthlyLimit,
      monthlyRemaining: Math.max(0, this.limits.monthlyLimit - monthlySpent),
      monthlyPercentage,
      isBlocked: this.blocked || dailyPercentage >= this.limits.blockThreshold || monthlyPercentage >= this.limits.blockThreshold,
      isAlertTriggered: dailyPercentage >= this.limits.alertThreshold || monthlyPercentage >= this.limits.alertThreshold,
    };
  }

  getLimits(): BudgetLimits {
    return { ...this.limits };
  }

  setLimits(updates: Partial<BudgetLimits>): void {
    this.limits = { ...this.limits, ...updates };
  }

  getAlerts(): BudgetAlert[] {
    return [...this.alerts];
  }

  getDailyEntries(): BudgetEntry[] {
    return [...this.dailyEntries];
  }

  getMonthlyEntries(): BudgetEntry[] {
    return [...this.monthlyEntries];
  }

  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = this.costPerToken.get(model);
    if (!pricing) return 0;
    return (promptTokens * pricing.input) + (completionTokens * pricing.output);
  }

  private estimateRequestCost(model: string, promptLength: number, maxTokens: number): number {
    const estimatedPromptTokens = Math.ceil(promptLength / 4);
    return this.calculateCost(model, estimatedPromptTokens, maxTokens);
  }

  private checkResets(): void {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), this.dailyResetHour, 0, 0).getTime();

    if (this.lastDailyReset < todayStart) {
      this.dailyReset();
    }

    const monthStart = new Date(now.getFullYear(), now.getMonth(), this.monthlyResetDay, 0, 0, 0).getTime();
    if (this.lastMonthlyReset < monthStart) {
      this.monthlyReset();
    }
  }

  private pruneOldEntries(): void {
    const now = Date.now();
    const oneDayAgo = now - 86400000;
    const thirtyDaysAgo = now - 30 * 86400000;

    this.dailyEntries = this.dailyEntries.filter((e) => e.timestamp > oneDayAgo);
    this.monthlyEntries = this.monthlyEntries.filter((e) => e.timestamp > thirtyDaysAgo);
  }

  private fireAlert(alert: BudgetAlert): void {
    this.alerts.push(alert);
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-this.maxAlerts);
    }
    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (error) {
        logger.error('Budget alert callback error', { error: (error as Error).message });
      }
    }
  }
}
