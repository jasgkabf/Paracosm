import type { ProviderConfig } from '@paracosm/shared';
import { BaseProvider } from './base-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { GoogleProvider } from './google-provider.js';
import { DeepSeekProvider } from './deepseek-provider.js';
import { MoonshotProvider } from './moonshot-provider.js';
import { OllamaProvider } from './ollama-provider.js';
import { LMStudioProvider } from './lmstudio-provider.js';
import { VLLMProvider } from './vllm-provider.js';
import { CustomOpenAIProvider } from './custom-openai-provider.js';
import { CustomProvider } from './custom/custom-provider.js';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('ProviderFactory');

export class ProviderFactory {
  private static providers: Map<string, BaseProvider> = new Map();
  private static customProviders: Map<string, CustomProvider> = new Map();

  static create(config: ProviderConfig): BaseProvider {
    const cacheKey = `${config.provider}:${config.baseUrl ?? 'default'}`;

    const cached = this.providers.get(cacheKey);
    if (cached) {
      return cached;
    }

    let provider: BaseProvider;

    switch (config.provider) {
      case 'openai':
        provider = new OpenAIProvider(config);
        break;
      case 'anthropic':
        provider = new AnthropicProvider(config);
        break;
      case 'google':
        provider = new GoogleProvider(config);
        break;
      case 'deepseek':
        provider = new DeepSeekProvider(config);
        break;
      case 'moonshot':
        provider = new MoonshotProvider(config);
        break;
      case 'ollama':
        provider = new OllamaProvider(config);
        break;
      case 'lmstudio':
        provider = new LMStudioProvider(config);
        break;
      case 'vllm':
        provider = new VLLMProvider(config);
        break;
      case 'custom':
        provider = new CustomOpenAIProvider(config);
        break;
      default:
        logger.warn('Unknown provider type, using OpenAI-compatible', {
          provider: config.provider,
        });
        provider = new CustomOpenAIProvider(config);
        break;
    }

    this.providers.set(cacheKey, provider);
    return provider;
  }

  static registerCustomProvider(id: string, provider: CustomProvider): void {
    this.customProviders.set(id, provider);
    logger.info('Custom provider registered', { id });
  }

  static unregisterCustomProvider(id: string): void {
    this.customProviders.delete(id);
    logger.info('Custom provider unregistered', { id });
  }

  static getCustomProvider(id: string): CustomProvider | undefined {
    return this.customProviders.get(id);
  }

  static getProvider(providerName: string, config: ProviderConfig): BaseProvider {
    const custom = this.customProviders.get(providerName);
    if (custom) return custom;

    return this.create(config);
  }

  static clearCache(): void {
    this.providers.clear();
  }

  static getSupportedProviders(): string[] {
    return [
      'openai',
      'anthropic',
      'google',
      'deepseek',
      'moonshot',
      'ollama',
      'lmstudio',
      'vllm',
      'custom',
    ];
  }

  static isSupported(provider: string): boolean {
    return this.getSupportedProviders().includes(provider) || this.customProviders.has(provider);
  }
}
