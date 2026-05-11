import { EventEmitter } from "node:events";
import { Result, ok, err } from "@paracosm/shared";
import { LLMError } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";

const logger = new Logger("BudgetGuard");

interface BudgetPeriod {
  spent: number;
  limit: number;
  requestCount: number;
  startDate: string;
}

export class BudgetGuard extends EventEmitter {
  private daily: BudgetPeriod;
  private monthly: BudgetPeriod;
  private perRequestLimit: number;
  private alertThresholdPercent: number;
  private throttleThresholdPercent: number;
  private throttled: boolean = false;
  private blocked: boolean = false;

  constructor(config: {
    dailyLimitUsd: number;
    monthlyLimitUsd: number;
    perRequestLimitUsd: number;
    alertThresholdPercent: number;
    throttleAtPercent: number;
  }) {
    super();
    const today = new Date().toISOString().split("T")[0];
    const month = today.substring(0, 7);

    this.daily = { spent: 0, limit: config.dailyLimitUsd, requestCount: 0, startDate: today };
    this.monthly = { spent: 0, limit: config.monthlyLimitUsd, requestCount: 0, startDate: month };
    this.perRequestLimit = config.perRequestLimitUsd;
    this.alertThresholdPercent = config.alertThresholdPercent;
    this.throttleThresholdPercent = config.throttleAtPercent;
  }

  check(estimatedCostUsd: number): Result<{ allowed: boolean; reason?: string }, LLMError> {
    if (this.blocked) {
      return ok({ allowed: false, reason: "Budget is blocked" });
    }

    if (estimatedCostUsd > this.perRequestLimit) {
      this.emit("per_request_exceeded", { estimated: estimatedCostUsd, limit: this.perRequestLimit });
      return ok({ allowed: false, reason: `Per-request limit exceeded: $${estimatedCostUsd.toFixed(4)} > $${this.perRequestLimit}` });
    }

    if (this.daily.spent + estimatedCostUsd > this.daily.limit) {
      this.emit("daily_exceeded", { spent: this.daily.spent, limit: this.daily.limit, estimated: estimatedCostUsd });
      return ok({ allowed: false, reason: `Daily budget would be exceeded: $${(this.daily.spent + estimatedCostUsd).toFixed(4)} > $${this.daily.limit}` });
    }

    if (this.monthly.spent + estimatedCostUsd > this.monthly.limit) {
      this.emit("monthly_exceeded", { spent: this.monthly.spent, limit: this.monthly.limit, estimated: estimatedCostUsd });
      return ok({ allowed: false, reason: `Monthly budget would be exceeded: $${(this.monthly.spent + estimatedCostUsd).toFixed(4)} > $${this.monthly.limit}` });
    }

    if (this.throttled) {
      return ok({ allowed: false, reason: "Budget is throttled" });
    }

    return ok({ allowed: true });
  }

  deduct(costUsd: number): void {
    this.resetIfNeeded();

    this.daily.spent += costUsd;
    this.daily.requestCount++;
    this.monthly.spent += costUsd;
    this.monthly.requestCount++;

    this.checkThresholds();
    this.emit("deducted", { costUsd, dailySpent: this.daily.spent, monthlySpent: this.monthly.spent });
  }

  alert(): { dailyPercentUsed: number; monthlyPercentUsed: number; shouldAlert: boolean } {
    const dailyPercentUsed = this.daily.limit > 0 ? (this.daily.spent / this.daily.limit) * 100 : 0;
    const monthlyPercentUsed = this.monthly.limit > 0 ? (this.monthly.spent / this.monthly.limit) * 100 : 0;
    const shouldAlert = dailyPercentUsed >= this.alertThresholdPercent || monthlyPercentUsed >= this.alertThresholdPercent;
    return { dailyPercentUsed, monthlyPercentUsed, shouldAlert };
  }

  block(): void {
    this.blocked = true;
    this.emit("blocked", { dailySpent: this.daily.spent, monthlySpent: this.monthly.spent });
    logger.warn("Budget guard has blocked all requests");
  }

  unblock(): void {
    this.blocked = false;
    this.throttled = false;
    this.emit("unblocked");
    logger.info("Budget guard has unblocked requests");
  }

  isBlocked(): boolean {
    return this.blocked;
  }

  isThrottled(): boolean {
    return this.throttled;
  }

  getStatus(): {
    daily: BudgetPeriod;
    monthly: BudgetPeriod;
    perRequestLimit: number;
    blocked: boolean;
    throttled: boolean;
  } {
    return {
      daily: { ...this.daily },
      monthly: { ...this.monthly },
      perRequestLimit: this.perRequestLimit,
      blocked: this.blocked,
      throttled: this.throttled,
    };
  }

  private resetIfNeeded(): void {
    const today = new Date().toISOString().split("T")[0];
    const month = today.substring(0, 7);

    if (this.daily.startDate !== today) {
      this.daily = { spent: 0, limit: this.daily.limit, requestCount: 0, startDate: today };
      this.throttled = false;
      this.emit("daily_reset", { date: today });
    }

    if (this.monthly.startDate !== month) {
      this.monthly = { spent: 0, limit: this.monthly.limit, requestCount: 0, startDate: month };
      this.emit("monthly_reset", { month });
    }
  }

  private checkThresholds(): void {
    const dailyPercent = this.daily.limit > 0 ? (this.daily.spent / this.daily.limit) * 100 : 0;
    const monthlyPercent = this.monthly.limit > 0 ? (this.monthly.spent / this.monthly.limit) * 100 : 0;

    if (dailyPercent >= this.alertThresholdPercent || monthlyPercent >= this.alertThresholdPercent) {
      this.emit("alert", { dailyPercent, monthlyPercent });
    }

    if (dailyPercent >= this.throttleThresholdPercent || monthlyPercent >= this.throttleThresholdPercent) {
      this.throttled = true;
      this.emit("throttled", { dailyPercent, monthlyPercent });
    }
  }
}
