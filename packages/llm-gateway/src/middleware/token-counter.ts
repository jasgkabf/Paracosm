import { EventEmitter } from "node:events";
import type { LLMUsage } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";

const logger = new Logger("TokenCounter");

export interface TokenCountRecord {
  providerId: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  timestamp: string;
  requestId: string;
}

export interface TokenBudget {
  dailyLimit: number;
  monthlyLimit: number;
  dailyUsed: number;
  monthlyUsed: number;
}

export class TokenCounter extends EventEmitter {
  private records: TokenCountRecord[] = [];
  private maxRecords: number = 10000;
  private dailyTotals: Map<string, { promptTokens: number; completionTokens: number; totalTokens: number; costUsd: number }> = new Map();
  private monthlyTotals: Map<string, { promptTokens: number; completionTokens: number; totalTokens: number; costUsd: number }> = new Map();
  private budget: TokenBudget | null = null;
  private alertThreshold: number = 0.8;

  count(usage: LLMUsage, providerId: string, modelId: string, requestId: string, costUsd: number = 0): TokenCountRecord {
    const record: TokenCountRecord = {
      providerId,
      modelId,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      estimatedCostUsd: costUsd,
      timestamp: new Date().toISOString(),
      requestId,
    };

    this.records.push(record);
    if (this.records.length > this.maxRecords) {
      this.records.shift();
    }

    this.updateTotals(record);
    this.checkBudget(record);

    this.emit("counted", record);
    return record;
  }

  track(providerId: string, modelId: string, usage: LLMUsage, costUsd: number = 0): void {
    this.count(usage, providerId, modelId, "", costUsd);
  }

  budgetCheck(): { withinBudget: boolean; dailyPercentUsed: number; monthlyPercentUsed: number; shouldAlert: boolean } {
    if (!this.budget) {
      return { withinBudget: true, dailyPercentUsed: 0, monthlyPercentUsed: 0, shouldAlert: false };
    }

    const dailyPercentUsed = this.budget.dailyLimit > 0 ? this.budget.dailyUsed / this.budget.dailyLimit : 0;
    const monthlyPercentUsed = this.budget.monthlyLimit > 0 ? this.budget.monthlyUsed / this.budget.monthlyLimit : 0;
    const withinBudget = dailyPercentUsed <= 1 && monthlyPercentUsed <= 1;
    const shouldAlert = dailyPercentUsed >= this.alertThreshold || monthlyPercentUsed >= this.alertThreshold;

    return { withinBudget, dailyPercentUsed, monthlyPercentUsed, shouldAlert };
  }

  alert(threshold: number): boolean {
    const check = this.budgetCheck();
    return check.dailyPercentUsed >= threshold || check.monthlyPercentUsed >= threshold;
  }

  report(period: "day" | "week" | "month" = "day"): {
    totalTokens: number;
    totalCostUsd: number;
    byModel: Map<string, { tokens: number; cost: number; requests: number }>;
    byProvider: Map<string, { tokens: number; cost: number; requests: number }>;
  } {
    const now = Date.now();
    let cutoff: number;

    switch (period) {
      case "day":
        cutoff = now - 24 * 60 * 60 * 1000;
        break;
      case "week":
        cutoff = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case "month":
        cutoff = now - 30 * 24 * 60 * 60 * 1000;
        break;
    }

    const filtered = this.records.filter((r) => new Date(r.timestamp).getTime() >= cutoff);

    const totalTokens = filtered.reduce((sum, r) => sum + r.totalTokens, 0);
    const totalCostUsd = filtered.reduce((sum, r) => sum + r.estimatedCostUsd, 0);

    const byModel = new Map<string, { tokens: number; cost: number; requests: number }>();
    const byProvider = new Map<string, { tokens: number; cost: number; requests: number }>();

    for (const record of filtered) {
      const modelEntry = byModel.get(record.modelId) ?? { tokens: 0, cost: 0, requests: 0 };
      modelEntry.tokens += record.totalTokens;
      modelEntry.cost += record.estimatedCostUsd;
      modelEntry.requests++;
      byModel.set(record.modelId, modelEntry);

      const providerEntry = byProvider.get(record.providerId) ?? { tokens: 0, cost: 0, requests: 0 };
      providerEntry.tokens += record.totalTokens;
      providerEntry.cost += record.estimatedCostUsd;
      providerEntry.requests++;
      byProvider.set(record.providerId, providerEntry);
    }

    return { totalTokens, totalCostUsd, byModel, byProvider };
  }

  setBudget(dailyLimit: number, monthlyLimit: number): void {
    this.budget = { dailyLimit, monthlyLimit, dailyUsed: 0, monthlyUsed: 0 };
  }

  private updateTotals(record: TokenCountRecord): void {
    const today = new Date().toISOString().split("T")[0];
    const month = today.substring(0, 7);

    const daily = this.dailyTotals.get(today) ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0 };
    daily.promptTokens += record.promptTokens;
    daily.completionTokens += record.completionTokens;
    daily.totalTokens += record.totalTokens;
    daily.costUsd += record.estimatedCostUsd;
    this.dailyTotals.set(today, daily);

    const monthly = this.monthlyTotals.get(month) ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0 };
    monthly.promptTokens += record.promptTokens;
    monthly.completionTokens += record.completionTokens;
    monthly.totalTokens += record.totalTokens;
    monthly.costUsd += record.estimatedCostUsd;
    this.monthlyTotals.set(month, monthly);

    if (this.budget) {
      this.budget.dailyUsed = daily.costUsd;
      this.budget.monthlyUsed = monthly.costUsd;
    }
  }

  private checkBudget(record: TokenCountRecord): void {
    const check = this.budgetCheck();
    if (check.shouldAlert) {
      this.emit("budget_alert", {
        dailyPercentUsed: check.dailyPercentUsed,
        monthlyPercentUsed: check.monthlyPercentUsed,
        record,
      });
      logger.warn(`Budget alert: daily ${((check.dailyPercentUsed) * 100).toFixed(1)}%, monthly ${((check.monthlyPercentUsed) * 100).toFixed(1)}%`);
    }
  }
}
