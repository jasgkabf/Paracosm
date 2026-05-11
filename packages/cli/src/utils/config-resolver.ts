import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { DEFAULT_PORT, APP_NAME } from "@paracosm/shared";

export const CONFIG_PATHS = {
  global: join(homedir(), ".paracosm", "config.json"),
  local: join(process.cwd(), ".paracosm.json"),
  directory: join(homedir(), ".paracosm"),
} as const;

interface ResolvedConfig {
  app?: {
    name?: string;
    port?: number;
    host?: string;
    logLevel?: string;
    environment?: string;
  };
  llm?: {
    defaultProvider?: string;
    defaultModel?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stream?: boolean;
  };
  providers?: Record<string, Record<string, unknown>>;
  routing?: Record<string, unknown>;
  budget?: Record<string, unknown>;
  fallback?: Record<string, unknown>;
  world?: Record<string, unknown>;
  strategy?: Record<string, unknown>;
  tools?: Record<string, unknown>;
  mcp?: Record<string, unknown>;
  port?: number;
  host?: string;
  defaultModel?: string;
  loaded?: boolean;
}

const DEFAULTS: ResolvedConfig = {
  app: {
    name: APP_NAME,
    port: DEFAULT_PORT,
    host: "0.0.0.0",
    logLevel: "info",
    environment: "development",
  },
  llm: {
    defaultProvider: "openai",
    defaultModel: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1.0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    stream: true,
  },
  providers: {},
  routing: {},
  budget: {},
  fallback: {},
  world: {},
  strategy: {},
  tools: {},
  mcp: {},
  port: DEFAULT_PORT,
  host: "0.0.0.0",
  defaultModel: "gpt-4o-mini",
  loaded: false,
};

function deepMergeConfig(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (
      key in result &&
      typeof result[key] === "object" &&
      result[key] !== null &&
      !Array.isArray(result[key]) &&
      typeof source[key] === "object" &&
      source[key] !== null &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMergeConfig(
        result[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>
      );
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

async function readConfigFile(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    if (!existsSync(filePath)) return null;
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function applyEnvOverrides(config: Record<string, unknown>): Record<string, unknown> {
  const envMappings: Record<string, string> = {
    PARACOSM_PORT: "app.port",
    PARACOSM_HOST: "app.host",
    PARACOSM_LOG_LEVEL: "app.logLevel",
    PARACOSM_ENV: "app.environment",
    PARACOSM_DEFAULT_PROVIDER: "llm.defaultProvider",
    PARACOSM_DEFAULT_MODEL: "llm.defaultModel",
    PARACOSM_OPENAI_API_KEY: "providers.openai.apiKey",
    PARACOSM_ANTHROPIC_API_KEY: "providers.anthropic.apiKey",
    PARACOSM_GOOGLE_API_KEY: "providers.google.apiKey",
    PARACOSM_DEEPSEEK_API_KEY: "providers.deepseek.apiKey",
  };

  let result = { ...config };

  for (const [envVar, configPath] of Object.entries(envMappings)) {
    const envValue = process.env[envVar];
    if (envValue !== undefined) {
      const keys = configPath.split(".");
      let target: Record<string, unknown> = result;

      for (let i = 0; i < keys.length - 1; i++) {
        if (typeof target[keys[i]] !== "object" || target[keys[i]] === null) {
          target[keys[i]] = {};
        }
        target = target[keys[i]] as Record<string, unknown>;
      }

      const lastKey = keys[keys.length - 1];
      let parsedValue: unknown = envValue;
      if (envValue === "true") parsedValue = true;
      else if (envValue === "false") parsedValue = false;
      else if (/^\d+$/.test(envValue)) parsedValue = parseInt(envValue, 10);
      else if (/^\d+\.\d+$/.test(envValue)) parsedValue = parseFloat(envValue);

      target[lastKey] = parsedValue;
    }
  }

  return result;
}

function flattenPortAndHost(config: Record<string, unknown>): void {
  if (config.app) {
    const app = config.app as Record<string, unknown>;
    if (app.port !== undefined) config.port = app.port as number;
    if (app.host !== undefined) config.host = app.host as string;
  }
  if (config.llm) {
    const llm = config.llm as Record<string, unknown>;
    if (llm.defaultModel !== undefined) config.defaultModel = llm.defaultModel as string;
  }
}

function validateConfig(config: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (config.port !== undefined) {
    const port = Number(config.port);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push("app.port must be between 1 and 65535");
    }
  }

  if (config.app) {
    const app = config.app as Record<string, unknown>;
    if (app.logLevel !== undefined) {
      const validLevels = ["trace", "debug", "info", "warn", "error", "fatal"];
      if (!validLevels.includes(app.logLevel as string)) {
        errors.push(`app.logLevel must be one of: ${validLevels.join(", ")}`);
      }
    }
    if (app.environment !== undefined) {
      const validEnvs = ["development", "production", "test"];
      if (!validEnvs.includes(app.environment as string)) {
        errors.push(`app.environment must be one of: ${validEnvs.join(", ")}`);
      }
    }
  }

  if (config.llm) {
    const llm = config.llm as Record<string, unknown>;
    if (llm.temperature !== undefined) {
      const temp = Number(llm.temperature);
      if (isNaN(temp) || temp < 0 || temp > 2) {
        errors.push("llm.temperature must be between 0 and 2");
      }
    }
    if (llm.maxTokens !== undefined) {
      const max = Number(llm.maxTokens);
      if (isNaN(max) || max < 1) {
        errors.push("llm.maxTokens must be a positive integer");
      }
    }
  }

  return errors;
}

export async function resolveConfig(
  configPath?: string
): Promise<ResolvedConfig> {
  let config = { ...DEFAULTS } as Record<string, unknown>;

  const globalConfig = await readConfigFile(CONFIG_PATHS.global);
  if (globalConfig) {
    config = deepMergeConfig(config, globalConfig);
  }

  const localConfig = await readConfigFile(CONFIG_PATHS.local);
  if (localConfig) {
    config = deepMergeConfig(config, localConfig);
  }

  if (configPath) {
    const customConfig = await readConfigFile(configPath);
    if (customConfig) {
      config = deepMergeConfig(config, customConfig);
    }
  }

  config = applyEnvOverrides(config);

  flattenPortAndHost(config);

  const errors = validateConfig(config);
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`Config validation error: ${error}`);
    }
  }

  (config as ResolvedConfig).loaded = true;
  return config as ResolvedConfig;
}

export async function saveConfig(
  config: unknown,
  target: "local" | "global" = "local"
): Promise<void> {
  const filePath = target === "global" ? CONFIG_PATHS.global : CONFIG_PATHS.local;
  const dir = dirname(filePath);

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  const content = JSON.stringify(config, null, 2);
  await writeFile(filePath, content, "utf-8");
}
