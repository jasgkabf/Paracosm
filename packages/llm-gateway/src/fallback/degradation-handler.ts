import { createLogger } from '@paracosm/shared';
import type { LLMProvider } from '@paracosm/shared';

const logger = createLogger('DegradationHandler');

export type DegradationLevel = 'none' | 'minor' | 'major' | 'critical' | 'outage';

export interface DegradationConfig {
  minorThreshold: number;
  majorThreshold: number;
  criticalThreshold: number;
  outageThreshold: number;
  autoResponseEnabled: boolean;
  recoveryCheckIntervalMs: number;
  maxDegradationDurationMs: number;
}

export interface DegradationEvent {
  id: string;
  provider: string;
  level: DegradationLevel;
  previousLevel: DegradationLevel;
  symptoms: string[];
  timestamp: number;
  autoResponse: DegradationResponse;
}

export interface DegradationResponse {
  action: string;
  description: string;
  providerOverride?: string;
  modelOverride?: string;
  featureReductions: string[];
  rateLimitAdjustment?: number;
  timeoutAdjustment?: number;
}

export interface DegradationSymptom {
  type: 'high_latency' | 'high_error_rate' | 'low_availability' | 'circuit_open' | 'timeout' | 'rate_limited';
  severity: number;
  provider: string;
  timestamp: number;
  details: Record<string, unknown>;
}

export class DegradationHandler {
  private config: DegradationConfig;
  private currentLevels: Map<string, DegradationLevel> = new Map();
  private events: DegradationEvent[] = [];
  private maxEvents: number = 500;
  private symptoms: Map<string, DegradationSymptom[]> = new Map();
  private maxSymptomsPerProvider: number = 100;
  private responseStrategies: Map<DegradationLevel, DegradationResponse> = new Map();
  private degradationStartTimes: Map<string, number> = new Map();
  private recoveryTimer: ReturnType<typeof setInterval> | null = null;
  private recoveryCallbacks: Map<string, () => Promise<boolean>> = new Map();

  constructor(config?: Partial<DegradationConfig>) {
    this.config = {
      minorThreshold: config?.minorThreshold ?? 0.8,
      majorThreshold: config?.majorThreshold ?? 0.6,
      criticalThreshold: config?.criticalThreshold ?? 0.3,
      outageThreshold: config?.outageThreshold ?? 0.1,
      autoResponseEnabled: config?.autoResponseEnabled ?? true,
      recoveryCheckIntervalMs: config?.recoveryCheckIntervalMs ?? 60000,
      maxDegradationDurationMs: config?.maxDegradationDurationMs ?? 1800000,
    };

    this.responseStrategies.set('none', {
      action: 'none',
      description: 'No degradation detected',
      featureReductions: [],
    });

    this.responseStrategies.set('minor', {
      action: 'reduce_features',
      description: 'Minor degradation: reducing non-essential features',
      featureReductions: ['semantic_cache', 'detailed_analytics'],
      timeoutAdjustment: 1.5,
    });

    this.responseStrategies.set('major', {
      action: 'fallback_priority',
      description: 'Major degradation: switching to fallback providers',
      featureReductions: ['semantic_cache', 'detailed_analytics', 'streaming', 'function_calling'],
      rateLimitAdjustment: 0.5,
      timeoutAdjustment: 2.0,
    });

    this.responseStrategies.set('critical', {
      action: 'minimal_service',
      description: 'Critical degradation: minimal service only',
      featureReductions: ['semantic_cache', 'detailed_analytics', 'streaming', 'function_calling', 'multi_persona'],
      rateLimitAdjustment: 0.25,
      timeoutAdjustment: 3.0,
    });

    this.responseStrategies.set('outage', {
      action: 'emergency_fallback',
      description: 'Outage: emergency fallback to any available provider',
      featureReductions: ['semantic_cache', 'detailed_analytics', 'streaming', 'function_calling', 'multi_persona', 'custom_models'],
      rateLimitAdjustment: 0.1,
      timeoutAdjustment: 5.0,
    });

    if (this.config.autoResponseEnabled) {
      this.startRecoveryCheck();
    }
  }

  detect(provider: string, metrics: {
    errorRate: number;
    latencyMs: number;
    availability: number;
    circuitOpen: boolean;
  }): DegradationLevel {
    const symptoms: DegradationSymptom[] = [];

    if (metrics.latencyMs > 10000) {
      symptoms.push({
        type: 'high_latency',
        severity: Math.min(1, metrics.latencyMs / 30000),
        provider,
        timestamp: Date.now(),
        details: { latencyMs: metrics.latencyMs },
      });
    }

    if (metrics.errorRate > 0.05) {
      symptoms.push({
        type: 'high_error_rate',
        severity: Math.min(1, metrics.errorRate),
        provider,
        timestamp: Date.now(),
        details: { errorRate: metrics.errorRate },
      });
    }

    if (metrics.availability < 0.95) {
      symptoms.push({
        type: 'low_availability',
        severity: 1 - metrics.availability,
        provider,
        timestamp: Date.now(),
        details: { availability: metrics.availability },
      });
    }

    if (metrics.circuitOpen) {
      symptoms.push({
        type: 'circuit_open',
        severity: 1,
        provider,
        timestamp: Date.now(),
        details: {},
      });
    }

    for (const symptom of symptoms) {
      this.addSymptom(provider, symptom);
    }

    return this.classify(provider, symptoms);
  }

  classify(provider: string, symptoms: DegradationSymptom[]): DegradationLevel {
    if (symptoms.length === 0) return 'none';

    const maxSeverity = Math.max(...symptoms.map((s) => s.severity));
    const hasCircuitOpen = symptoms.some((s) => s.type === 'circuit_open');
    const hasOutage = symptoms.some((s) => s.type === 'low_availability' && s.severity > 0.9);

    if (hasOutage || (hasCircuitOpen && maxSeverity > 0.8)) return 'outage';
    if (maxSeverity >= this.config.criticalThreshold || hasCircuitOpen) return 'critical';
    if (maxSeverity >= this.config.majorThreshold) return 'major';
    if (maxSeverity >= this.config.minorThreshold) return 'minor';

    return 'none';
  }

  respond(provider: string, level: DegradationLevel): DegradationEvent {
    const previousLevel = this.currentLevels.get(provider) ?? 'none';
    this.currentLevels.set(provider, level);

    if (level !== 'none' && !this.degradationStartTimes.has(provider)) {
      this.degradationStartTimes.set(provider, Date.now());
    } else if (level === 'none') {
      this.degradationStartTimes.delete(provider);
    }

    const symptoms = this.symptoms.get(provider) ?? [];
    const recentSymptoms = symptoms.filter(
      (s) => Date.now() - s.timestamp < 300000,
    );

    const strategy = this.responseStrategies.get(level) ?? this.responseStrategies.get('none')!;
    const response: DegradationResponse = { ...strategy };

    const event: DegradationEvent = {
      id: `deg_${Date.now()}_${provider}`,
      provider,
      level,
      previousLevel,
      symptoms: recentSymptoms.map((s) => s.type),
      timestamp: Date.now(),
      autoResponse: response,
    };

    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    logger.info('Degradation response applied', {
      provider,
      level,
      previousLevel,
      action: response.action,
      featureReductions: response.featureReductions,
    });

    return event;
  }

  graceful(provider: string): DegradationResponse {
    const level = this.currentLevels.get(provider) ?? 'none';
    const strategy = this.responseStrategies.get(level) ?? this.responseStrategies.get('none')!;

    const response: DegradationResponse = {
      ...strategy,
      description: level === 'none'
        ? 'Service operating normally'
        : `Graceful degradation for ${provider}: ${strategy.description}`,
    };

    if (level !== 'none') {
      logger.info('Graceful degradation applied', {
        provider,
        level,
        action: response.action,
      });
    }

    return response;
  }

  getCurrentLevel(provider: string): DegradationLevel {
    return this.currentLevels.get(provider) ?? 'none';
  }

  getAllLevels(): Record<string, DegradationLevel> {
    const result: Record<string, DegradationLevel> = {};
    for (const [provider, level] of this.currentLevels) {
      result[provider] = level;
    }
    return result;
  }

  getEvents(filter?: {
    provider?: string;
    level?: DegradationLevel;
    limit?: number;
  }): DegradationEvent[] {
    let result = [...this.events];

    if (filter?.provider) {
      result = result.filter((e) => e.provider === filter.provider);
    }
    if (filter?.level) {
      result = result.filter((e) => e.level === filter.level);
    }
    if (filter?.limit) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  getSymptoms(provider: string): DegradationSymptom[] {
    return [...(this.symptoms.get(provider) ?? [])];
  }

  getResponseStrategy(level: DegradationLevel): DegradationResponse | undefined {
    const strategy = this.responseStrategies.get(level);
    return strategy ? { ...strategy } : undefined;
  }

  setResponseStrategy(level: DegradationLevel, response: DegradationResponse): void {
    this.responseStrategies.set(level, response);
  }

  registerRecoveryCallback(provider: string, callback: () => Promise<boolean>): void {
    this.recoveryCallbacks.set(provider, callback);
  }

  getDegradationDuration(provider: string): number {
    const startTime = this.degradationStartTimes.get(provider);
    if (!startTime) return 0;
    return Date.now() - startTime;
  }

  reset(provider: string): void {
    this.currentLevels.set(provider, 'none');
    this.degradationStartTimes.delete(provider);
    this.symptoms.delete(provider);
    logger.info('Degradation reset', { provider });
  }

  destroy(): void {
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
      this.recoveryTimer = null;
    }
  }

  private addSymptom(provider: string, symptom: DegradationSymptom): void {
    if (!this.symptoms.has(provider)) {
      this.symptoms.set(provider, []);
    }
    const providerSymptoms = this.symptoms.get(provider)!;
    providerSymptoms.push(symptom);
    if (providerSymptoms.length > this.maxSymptomsPerProvider) {
      providerSymptoms.splice(0, providerSymptoms.length - this.maxSymptomsPerProvider);
    }
  }

  private startRecoveryCheck(): void {
    if (this.recoveryTimer) return;
    this.recoveryTimer = setInterval(async () => {
      for (const [provider, startTime] of this.degradationStartTimes) {
        const duration = Date.now() - startTime;
        if (duration > this.config.maxDegradationDurationMs) {
          logger.warn('Degradation exceeded max duration', {
            provider,
            durationMs: duration,
          });
        }

        const callback = this.recoveryCallbacks.get(provider);
        if (callback) {
          try {
            const recovered = await callback();
            if (recovered) {
              this.reset(provider);
              logger.info('Provider recovered via recovery callback', { provider });
            }
          } catch (error) {
            logger.error('Recovery callback error', {
              provider,
              error: (error as Error).message,
            });
          }
        }
      }
    }, this.config.recoveryCheckIntervalMs);
  }
}
