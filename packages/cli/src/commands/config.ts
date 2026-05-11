import { Command } from "commander";
import chalk from "chalk";
import { render } from "ink";
import React from "react";
import { APP_NAME, DEFAULT_PORT } from "@paracosm/shared";
import { ConfigWizard } from "../ui/config-wizard.js";
import { formatOutput } from "../utils/output.js";
import { resolveConfig, saveConfig, CONFIG_PATHS } from "../utils/config-resolver.js";

interface ConfigInitOptions {
  force?: boolean;
  minimal?: boolean;
}

interface ConfigSetOptions {
  global?: boolean;
}

interface ConfigGetOptions {
  format?: "json" | "text";
}

interface ConfigListOptions {
  format?: "json" | "table";
  section?: string;
}

interface ConfigValidateOptions {
  strict?: boolean;
}

interface ConfigExportOptions {
  format?: "json" | "yaml";
  output?: string;
  redact?: boolean;
}

interface ConfigImportOptions {
  format?: "json" | "yaml";
  merge?: boolean;
  dryRun?: boolean;
}

const DEFAULT_CONFIG = {
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
  providers: {
    openai: {
      apiKey: "",
      baseUrl: "https://api.openai.com/v1",
      organizationId: null,
      enabled: true,
      rateLimitRpm: 60,
      timeoutMs: 30000,
    },
    anthropic: {
      apiKey: "",
      baseUrl: "https://api.anthropic.com",
      enabled: true,
      rateLimitRpm: 60,
      timeoutMs: 30000,
    },
    google: {
      apiKey: "",
      baseUrl: "https://generativelanguage.googleapis.com",
      enabled: false,
      rateLimitRpm: 60,
      timeoutMs: 30000,
    },
    deepseek: {
      apiKey: "",
      baseUrl: "https://api.deepseek.com",
      enabled: false,
      rateLimitRpm: 60,
      timeoutMs: 30000,
    },
    ollama: {
      baseUrl: "http://localhost:11434",
      enabled: false,
      rateLimitRpm: 0,
      timeoutMs: 60000,
    },
  },
  routing: {
    strategy: "balanced",
    enableCaching: true,
    cacheTtlMs: 300000,
    maxCacheSize: 1000,
  },
  budget: {
    dailyLimitUsd: 10,
    monthlyLimitUsd: 100,
    perRequestLimitUsd: 1,
    alertThresholdPercent: 80,
    enableThrottling: true,
    throttleAtPercent: 90,
  },
  fallback: {
    enableAutomaticFallback: true,
    fallbackOnError: true,
    fallbackOnTimeout: true,
    fallbackOnRateLimit: true,
    fallbackOnContentFilter: true,
  },
  world: {
    autoSaveIntervalMs: 60000,
    maxEntities: 10000,
    maxRelations: 50000,
    snapshotIntervalMs: 300000,
  },
  strategy: {
    populationSize: 50,
    maxGenerations: 100,
    mutationRate: 0.1,
    crossoverRate: 0.7,
    stagnationThreshold: 10,
  },
  tools: {
    maxConcurrentExecutions: 5,
    defaultTimeoutMs: 30000,
    sandboxEnabled: true,
    auditLog: true,
  },
  mcp: {
    servers: [],
    defaultTimeoutMs: 30000,
    maxConcurrentConnections: 10,
    healthCheckIntervalMs: 60000,
  },
};

async function handleConfigInit(options: ConfigInitOptions): Promise<void> {
  const config = await resolveConfig();
  const existingConfig = config.loaded;

  if (existingConfig && !options.force) {
    console.log(
      chalk.yellow("Configuration already exists."),
      chalk.gray("Use --force to overwrite.")
    );
    return;
  }

  if (options.minimal) {
    const minimalConfig = {
      app: DEFAULT_CONFIG.app,
      llm: DEFAULT_CONFIG.llm,
      providers: {
        openai: { ...DEFAULT_CONFIG.providers.openai },
      },
    };
    await saveConfig(minimalConfig);
    console.log(chalk.green("Minimal configuration created."));
    return;
  }

  const { waitUntilExit } = render(
    React.createElement(ConfigWizard, {
      initialConfig: DEFAULT_CONFIG,
      onComplete: async (finalConfig: unknown) => {
        await saveConfig(finalConfig);
        console.log(chalk.green("Configuration saved successfully."));
      },
    })
  );

  await waitUntilExit();
}

async function handleConfigSet(
  key: string,
  value: string,
  options: ConfigSetOptions
): Promise<void> {
  const config = await resolveConfig();
  const keys = key.split(".");
  let target: Record<string, unknown> = config as Record<string, unknown>;

  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof target[keys[i]] !== "object" || target[keys[i]] === null) {
      target[keys[i]] = {};
    }
    target = target[keys[i]] as Record<string, unknown>;
  }

  const lastKey = keys[keys.length - 1];
  let parsedValue: unknown = value;

  if (value === "true") parsedValue = true;
  else if (value === "false") parsedValue = false;
  else if (value === "null") parsedValue = null;
  else if (/^\d+$/.test(value)) parsedValue = parseInt(value, 10);
  else if (/^\d+\.\d+$/.test(value)) parsedValue = parseFloat(value);

  target[lastKey] = parsedValue;
  await saveConfig(config);

  console.log(chalk.green(`Set ${key} = ${JSON.stringify(parsedValue)}`));
}

async function handleConfigGet(
  key: string,
  options: ConfigGetOptions
): Promise<void> {
  const config = await resolveConfig();
  const keys = key.split(".");
  let current: unknown = config;

  for (const k of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      console.error(chalk.red(`Key not found: ${key}`));
      process.exit(1);
    }
    current = (current as Record<string, unknown>)[k];
  }

  if (current === undefined) {
    console.error(chalk.red(`Key not found: ${key}`));
    process.exit(1);
  }

  if (options.format === "json") {
    formatOutput({ key, value: current }, { format: "json", colorize: true });
  } else {
    console.log(typeof current === "object" ? JSON.stringify(current, null, 2) : String(current));
  }
}

async function handleConfigList(options: ConfigListOptions): Promise<void> {
  const config = await resolveConfig();
  let data = config as Record<string, unknown>;

  if (options.section) {
    data = (data[options.section] ?? {}) as Record<string, unknown>;
    if (Object.keys(data).length === 0) {
      console.error(chalk.red(`Section not found: ${options.section}`));
      process.exit(1);
    }
  }

  const flattened = flattenConfig(data);
  formatOutput(flattened, { format: options.format ?? "table", colorize: true });
}

async function handleConfigValidate(options: ConfigValidateOptions): Promise<void> {
  const config = await resolveConfig();
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.app?.port || config.app.port < 1 || config.app.port > 65535) {
    errors.push("app.port must be between 1 and 65535");
  }

  if (!config.llm?.defaultModel) {
    errors.push("llm.defaultModel is required");
  }

  if (!config.llm?.defaultProvider) {
    errors.push("llm.defaultProvider is required");
  }

  const providers = config.providers as Record<string, Record<string, unknown>> | undefined;
  if (providers) {
    for (const [name, provider] of Object.entries(providers)) {
      if (provider.enabled && !provider.apiKey && name !== "ollama") {
        if (options.strict) {
          errors.push(`providers.${name}.apiKey is required when provider is enabled`);
        } else {
          warnings.push(`providers.${name}.apiKey is empty - provider may not work`);
        }
      }
    }
  }

  if (config.budget?.dailyLimitUsd && config.budget.dailyLimitUsd <= 0) {
    errors.push("budget.dailyLimitUsd must be positive");
  }

  if (config.budget?.monthlyLimitUsd && config.budget.monthlyLimitUsd <= 0) {
    errors.push("budget.monthlyLimitUsd must be positive");
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log(chalk.green("Configuration is valid."));
  } else {
    if (errors.length > 0) {
      console.log(chalk.red(`Errors (${errors.length}):`));
      errors.forEach((e) => console.log(chalk.red(`  - ${e}`)));
    }
    if (warnings.length > 0) {
      console.log(chalk.yellow(`Warnings (${warnings.length}):`));
      warnings.forEach((w) => console.log(chalk.yellow(`  - ${w}`)));
    }
    if (errors.length > 0) {
      process.exit(1);
    }
  }
}

async function handleConfigExport(options: ConfigExportOptions): Promise<void> {
  const config = await resolveConfig();
  let exported = { ...config };

  if (options.redact) {
    exported = redactSecrets(exported);
  }

  let output: string;
  if (options.format === "yaml") {
    output = jsonToYaml(exported);
  } else {
    output = JSON.stringify(exported, null, 2);
  }

  if (options.output) {
    const fs = await import("node:fs/promises");
    await fs.writeFile(options.output, output, "utf-8");
    console.log(chalk.green(`Configuration exported to ${options.output}`));
  } else {
    console.log(output);
  }
}

async function handleConfigImport(
  filePath: string,
  options: ConfigImportOptions
): Promise<void> {
  const fs = await import("node:fs/promises");
  const content = await fs.readFile(filePath, "utf-8");

  let imported: unknown;
  if (options.format === "yaml") {
    imported = yamlToJson(content);
  } else {
    imported = JSON.parse(content);
  }

  if (options.dryRun) {
    console.log(chalk.blue("Dry run - no changes will be made."));
    console.log(JSON.stringify(imported, null, 2));
    return;
  }

  if (options.merge) {
    const existing = await resolveConfig();
    const merged = deepMerge(existing, imported);
    await saveConfig(merged);
    console.log(chalk.green("Configuration merged and saved."));
  } else {
    await saveConfig(imported);
    console.log(chalk.green("Configuration imported and saved."));
  }
}

function flattenConfig(
  obj: Record<string, unknown>,
  prefix = ""
): Array<{ key: string; value: string }> {
  const result: Array<{ key: string; value: string }> = [];
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      result.push(...flattenConfig(val as Record<string, unknown>, fullKey));
    } else {
      result.push({ key: fullKey, value: JSON.stringify(val) });
    }
  }
  return result;
}

function redactSecrets(obj: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...obj };
  const secretKeys = ["apiKey", "secret", "token", "password", "credential"];

  for (const [key, value] of Object.entries(redacted)) {
    if (secretKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
      redacted[key] = "***REDACTED***";
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      redacted[key] = redactSecrets(value as Record<string, unknown>);
    }
  }

  return redacted;
}

function deepMerge(target: unknown, source: unknown): unknown {
  if (typeof target !== "object" || target === null) return source;
  if (typeof source !== "object" || source === null) return source;

  const result = { ...(target as Record<string, unknown>) };
  const src = source as Record<string, unknown>;

  for (const key of Object.keys(src)) {
    if (
      typeof src[key] === "object" &&
      src[key] !== null &&
      !Array.isArray(src[key]) &&
      typeof result[key] === "object" &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], src[key]);
    } else {
      result[key] = src[key];
    }
  }

  return result;
}

function jsonToYaml(obj: unknown, indent = 0): string {
  const prefix = "  ".repeat(indent);
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "boolean") return obj ? "true" : "false";
  if (typeof obj === "number") return String(obj);
  if (typeof obj === "string") {
    if (obj.includes("\n") || obj.includes(":") || obj.includes("#")) {
      return `"${obj.replace(/"/g, '\\"')}"`;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return obj
      .map((item) => `${prefix}- ${jsonToYaml(item, indent + 1)}`)
      .join("\n");
  }
  const entries = Object.entries(obj as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  return entries
    .map(([key, value]) => {
      const val = jsonToYaml(value, indent + 1);
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        return `${prefix}${key}:\n${val}`;
      }
      return `${prefix}${key}: ${val}`;
    })
    .join("\n");
}

function yamlToJson(yaml: string): unknown {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");
  const stack: Array<{ obj: Record<string, unknown>; indent: number }> = [];
  let current = result;
  let currentIndent = 0;

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const indent = line.search(/\S/);
    const content = line.trim();

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    if (stack.length > 0) {
      current = stack[stack.length - 1].obj;
    } else {
      current = result;
    }
    currentIndent = indent;

    const colonIndex = content.indexOf(":");
    if (colonIndex === -1) continue;

    const key = content.slice(0, colonIndex).trim();
    const valueStr = content.slice(colonIndex + 1).trim();

    if (valueStr === "" || valueStr === "|" || valueStr === ">") {
      const newObj: Record<string, unknown> = {};
      current[key] = newObj;
      stack.push({ obj: newObj, indent: currentIndent });
    } else {
      current[key] = parseYamlValue(valueStr);
    }
  }

  return result;
}

function parseYamlValue(value: string): unknown {
  if (value === "null" || value === "~") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
}

export function registerConfigCommand(program: Command): void {
  const config = program
    .command("config")
    .description("Manage Paracosm configuration");

  config
    .command("init")
    .description("Initialize a new configuration file")
    .option("--force", "overwrite existing configuration")
    .option("--minimal", "create minimal configuration")
    .action(async (options: ConfigInitOptions) => {
      await handleConfigInit(options);
    });

  config
    .command("set")
    .description("Set a configuration value")
    .argument("<key>", "configuration key (dot notation)")
    .argument("<value>", "configuration value")
    .option("--global", "set in global config")
    .action(async (key: string, value: string, options: ConfigSetOptions) => {
      await handleConfigSet(key, value, options);
    });

  config
    .command("get")
    .description("Get a configuration value")
    .argument("<key>", "configuration key (dot notation)")
    .option("-f, --format <format>", "output format: json, text")
    .action(async (key: string, options: ConfigGetOptions) => {
      await handleConfigGet(key, options);
    });

  config
    .command("list")
    .description("List all configuration values")
    .option("-f, --format <format>", "output format: json, table")
    .option("-s, --section <section>", "filter by section")
    .action(async (options: ConfigListOptions) => {
      await handleConfigList(options);
    });

  config
    .command("validate")
    .description("Validate the current configuration")
    .option("--strict", "treat warnings as errors")
    .action(async (options: ConfigValidateOptions) => {
      await handleConfigValidate(options);
    });

  config
    .command("export")
    .description("Export configuration to a file")
    .option("-f, --format <format>", "output format: json, yaml")
    .option("-o, --output <path>", "output file path")
    .option("--redact", "redact sensitive values")
    .action(async (options: ConfigExportOptions) => {
      await handleConfigExport(options);
    });

  config
    .command("import")
    .description("Import configuration from a file")
    .argument("<file>", "path to configuration file")
    .option("-f, --format <format>", "input format: json, yaml")
    .option("--merge", "merge with existing configuration")
    .option("--dry-run", "preview changes without saving")
    .action(async (file: string, options: ConfigImportOptions) => {
      await handleConfigImport(file, options);
    });
}
