import type { ProviderConfig, BudgetConfig, FallbackConfig, RoutingRule } from '@paracosm/shared';
import type { ConfigFile } from './config-manager.js';
import { PROVIDER_ENDPOINTS, DEFAULT_TIMEOUTS, MAX_RETRIES } from '@paracosm/shared';

export class ConfigDefaults {
  static getDefaultConfig(): ConfigFile {
    return {
      version: 3,
      defaultProvider: 'openai',
      defaultModel: 'gpt-4o-mini',
      providers: [
        {
          provider: 'openai',
          apiKey: '',
          baseUrl: PROVIDER_ENDPOINTS['openai'],
          models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
          defaultModel: 'gpt-4o-mini',
          maxConcurrentRequests: 10,
          timeout: DEFAULT_TIMEOUTS['openai'],
          retries: MAX_RETRIES['openai'],
          metadata: {},
        },
        {
          provider: 'anthropic',
          apiKey: '',
          baseUrl: PROVIDER_ENDPOINTS['anthropic'],
          models: ['claude-3-opus-20240229', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
          defaultModel: 'claude-3-5-sonnet-20241022',
          maxConcurrentRequests: 10,
          timeout: DEFAULT_TIMEOUTS['anthropic'],
          retries: MAX_RETRIES['anthropic'],
          metadata: {},
        },
        {
          provider: 'google',
          apiKey: '',
          baseUrl: PROVIDER_ENDPOINTS['google'],
          models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
          defaultModel: 'gemini-1.5-flash',
          maxConcurrentRequests: 10,
          timeout: DEFAULT_TIMEOUTS['google'],
          retries: MAX_RETRIES['google'],
          metadata: {},
        },
      ],
      routing: {
        strategy: 'adaptive',
        rules: [
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
            id: 'rule-reasoning',
            name: 'Reasoning',
            condition: 'taskType === "reasoning"',
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
            id: 'rule-summarization',
            name: 'Summarization',
            condition: 'taskType === "summarization"',
            provider: 'anthropic',
            model: 'claude-3-haiku-20240307',
            priority: 1,
            enabled: true,
            metadata: {},
          },
          {
            id: 'rule-creative',
            name: 'Creative Writing',
            condition: 'taskType === "creative_writing"',
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
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
        ],
      },
      budget: {
        dailyLimit: 10,
        monthlyLimit: 100,
        perRequestLimit: 1,
        alertThreshold: 0.8,
        currency: 'USD',
      },
      fallback: {
        enabled: true,
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2,
        fallbackProviders: ['anthropic', 'google'],
        fallbackModels: ['gpt-4o-mini', 'claude-3-haiku-20240307'],
      },
      retries: 3,
      timeout: 30000,
      encryption: {
        enabled: false,
        algorithm: 'aes-256-gcm',
      },
      metadata: {},
    };
  }

  static mergeWithDefaults(partial?: Partial<ConfigFile>): ConfigFile {
    const defaults = this.getDefaultConfig();

    if (!partial) return defaults;

    return {
      version: partial.version ?? defaults.version,
      defaultProvider: partial.defaultProvider ?? defaults.defaultProvider,
      defaultModel: partial.defaultModel ?? defaults.defaultModel,
      providers: partial.providers ?? defaults.providers,
      routing: {
        strategy: partial.routing?.strategy ?? defaults.routing.strategy,
        rules: partial.routing?.rules ?? defaults.routing.rules,
      },
      budget: {
        ...defaults.budget,
        ...partial.budget,
      },
      fallback: {
        ...defaults.fallback,
        ...partial.fallback,
      },
      retries: partial.retries ?? defaults.retries,
      timeout: partial.timeout ?? defaults.timeout,
      encryption: {
        ...defaults.encryption,
        ...partial.encryption,
      },
      metadata: {
        ...defaults.metadata,
        ...partial.metadata,
      },
    };
  }

  static getDefaultProviderConfig(providerName: string): ProviderConfig {
    const endpoint = PROVIDER_ENDPOINTS[providerName] || '';
    const timeout = DEFAULT_TIMEOUTS[providerName] || 30000;
    const retries = MAX_RETRIES[providerName] || 3;

    const modelDefaults: Record<string, string[]> = {
      openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      anthropic: ['claude-3-opus-20240229', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
      google: ['gemini-1.5-pro', 'gemini-1.5-flash'],
      mistral: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'],
      cohere: ['command-r-plus', 'command-r'],
      deepseek: ['deepseek-chat', 'deepseek-coder'],
      moonshot: ['moonshot-v1-8k', 'moonshot-v1-32k'],
      ollama: ['llama3', 'mistral', 'codellama'],
      lmstudio: ['local-model'],
      vllm: ['local-model'],
      local: ['local-model'],
    };

    const models = modelDefaults[providerName] || ['default'];
    const defaultModel = models[0];

    return {
      provider: providerName as ProviderConfig['provider'],
      apiKey: providerName === 'local' ? 'local' : '',
      baseUrl: endpoint,
      models,
      defaultModel,
      maxConcurrentRequests: 10,
      timeout,
      retries,
      metadata: {},
    };
  }
}

export function getDefaultConfig(): ConfigFile {
  return ConfigDefaults.getDefaultConfig();
}
