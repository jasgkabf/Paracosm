import { LLMProvider } from "@paracosm/shared";
import type { ProviderConfig } from "@paracosm/shared";
import { Result, ok, err } from "@paracosm/shared";
import { ConfigError } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";
import { BaseProvider } from "./base-provider.js";
import { OpenAIProvider } from "./openai-provider.js";
import { AnthropicProvider } from "./anthropic-provider.js";
import { GoogleProvider } from "./google-provider.js";
import { DeepSeekProvider } from "./deepseek-provider.js";
import { MoonshotProvider } from "./moonshot-provider.js";
import { OllamaProvider } from "./ollama-provider.js";
import { LMStudioProvider } from "./lmstudio-provider.js";
import { VLLMProvider } from "./vllm-provider.js";
import { CustomOpenAIProvider } from "./custom-openai-provider.js";

const logger = new Logger("ProviderFactory");

type ProviderConstructor = new (config: ProviderConfig) => BaseProvider;

const PROVIDER_REGISTRY = new Map<string, ProviderConstructor>([
  ["openai", OpenAIProvider as ProviderConstructor],
  ["anthropic", AnthropicProvider as ProviderConstructor],
  ["google", GoogleProvider as ProviderConstructor],
  ["deepseek", DeepSeekProvider as ProviderConstructor],
  ["moonshot", MoonshotProvider as ProviderConstructor],
  ["ollama", OllamaProvider as ProviderConstructor],
  ["lmstudio", LMStudioProvider as ProviderConstructor],
  ["vllm", VLLMProvider as ProviderConstructor],
  ["custom-openai", CustomOpenAIProvider as ProviderConstructor],
]);

export class ProviderFactory {
  private customProviders: Map<string, ProviderConstructor> = new Map();

  create(config: ProviderConfig): Result<BaseProvider, ConfigError> {
    const providerType = this.detectProviderType(config);
    const Constructor = this.customProviders.get(providerType) ?? PROVIDER_REGISTRY.get(providerType);

    if (!Constructor) {
      return err(new ConfigError(
        `Unknown provider type: ${providerType}`,
        { providerType, providerId: config.providerId as string },
      ));
    }

    try {
      const provider = new Constructor(config);
      logger.info(`Created provider: ${providerType} (${config.providerId})`);
      return ok(provider);
    } catch (error) {
      return err(new ConfigError(
        `Failed to create provider: ${error instanceof Error ? error.message : String(error)}`,
        { providerType, providerId: config.providerId as string },
        error instanceof Error ? error : undefined,
      ));
    }
  }

  register(providerType: string, constructor: ProviderConstructor): void {
    this.customProviders.set(providerType, constructor);
    logger.info(`Registered custom provider type: ${providerType}`);
  }

  detect(config: ProviderConfig): string {
    return this.detectProviderType(config);
  }

  autoConfigure(config: ProviderConfig): Result<BaseProvider, ConfigError> {
    const providerType = this.detectProviderType(config);

    if (providerType === "unknown") {
      if (config.baseUrl.includes("/v1") || config.baseUrl.includes(":11434")) {
        const adjustedConfig = { ...config, provider: LLMProvider.Custom };
        return this.create(adjustedConfig);
      }
      return err(new ConfigError(
        `Cannot auto-configure provider for baseUrl: ${config.baseUrl}`,
        { baseUrl: config.baseUrl },
      ));
    }

    return this.create(config);
  }

  getRegisteredTypes(): string[] {
    return [...PROVIDER_REGISTRY.keys(), ...this.customProviders.keys()];
  }

  isRegistered(providerType: string): boolean {
    return PROVIDER_REGISTRY.has(providerType) || this.customProviders.has(providerType);
  }

  private detectProviderType(config: ProviderConfig): string {
    const provider = config.provider as string;

    if (PROVIDER_REGISTRY.has(provider) || this.customProviders.has(provider)) {
      return provider;
    }

    const baseUrl = config.baseUrl.toLowerCase();

    if (baseUrl.includes("api.openai.com")) return "openai";
    if (baseUrl.includes("api.anthropic.com")) return "anthropic";
    if (baseUrl.includes("generativelanguage.googleapis.com")) return "google";
    if (baseUrl.includes("api.deepseek.com")) return "deepseek";
    if (baseUrl.includes("api.moonshot.cn")) return "moonshot";
    if (baseUrl.includes(":11434")) return "ollama";
    if (baseUrl.includes(":1234")) return "lmstudio";
    if (baseUrl.includes(":8000")) return "vllm";

    if (baseUrl.includes("/v1/chat/completions") || baseUrl.includes("/v1")) {
      return "custom-openai";
    }

    return "custom-openai";
  }
}
