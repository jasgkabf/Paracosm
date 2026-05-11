import { EventEmitter } from "node:events";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { Result, ok, err } from "@paracosm/shared";
import { ConfigError, ValidationError } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";
import { generateId } from "@paracosm/shared";
import { validateProvidersConfig, applyProvidersDefaults } from "./providers-schema.js";
import { validateModelsConfig, applyModelsDefaults } from "./models-schema.js";
import { validateRoutingConfig, applyRoutingDefaults } from "./routing-schema.js";
import { validateBudgetsConfig, applyBudgetsDefaults } from "./budgets-schema.js";
import { validateFallbackConfig, applyFallbackDefaults } from "./fallback-schema.js";
import { CONFIG_VERSION, CONFIG_FILE_NAMES } from "./config-defaults.js";
import type { ProvidersSchema } from "./providers-schema.js";
import type { ModelsSchema } from "./models-schema.js";
import type { RoutingSchema } from "./routing-schema.js";
import type { BudgetsSchema } from "./budgets-schema.js";
import type { FallbackSchema } from "./fallback-schema.js";

const logger = new Logger("ConfigManager");

export interface ConfigData {
  providers: ProvidersSchema;
  models: ModelsSchema;
  routing: RoutingSchema;
  budgets: BudgetsSchema;
  fallback: FallbackSchema;
}

type ConfigSection = keyof ConfigData;

const SCHEMA_VALIDATORS: Record<ConfigSection, (data: unknown) => { valid: boolean; errors: string[] }> = {
  providers: validateProvidersConfig,
  models: validateModelsConfig,
  routing: validateRoutingConfig,
  budgets: validateBudgetsConfig,
  fallback: validateFallbackConfig,
};

export class ConfigManager extends EventEmitter {
  private configDir: string;
  private config: ConfigData;
  private loaded: boolean = false;
  private dirty: Set<ConfigSection> = new Set();

  constructor(configDir: string) {
    super();
    this.configDir = configDir;
    this.config = this.createDefaultConfig();
  }

  private createDefaultConfig(): ConfigData {
    return {
      providers: applyProvidersDefaults({}),
      models: applyModelsDefaults({}),
      routing: applyRoutingDefaults({}),
      budgets: applyBudgetsDefaults({}),
      fallback: applyFallbackDefaults({}),
    };
  }

  async load(): Promise<Result<ConfigData, ConfigError>> {
    try {
      await mkdir(this.configDir, { recursive: true });
      const sections: Partial<ConfigData> = {};
      const loadErrors: string[] = [];

      for (const [section, fileName] of Object.entries(CONFIG_FILE_NAMES)) {
        const filePath = join(this.configDir, fileName);
        try {
          await access(filePath);
          const content = await readFile(filePath, "utf-8");
          const parsed = this.parseYaml(content);
          const validator = SCHEMA_VALIDATORS[section as ConfigSection];
          const validation = validator(parsed);
          if (!validation.valid) {
            loadErrors.push(`${section}: ${validation.errors.join(", ")}`);
            (sections as Record<string, unknown>)[section] = this.getDefaultForSection(section as ConfigSection);
          } else {
            (sections as Record<string, unknown>)[section] = parsed;
          }
        } catch {
          (sections as Record<string, unknown>)[section] = this.getDefaultForSection(section as ConfigSection);
        }
      }

      if (loadErrors.length > 0) {
        logger.warn(`Config loaded with validation errors: ${loadErrors.join("; ")}`);
      }

      this.config = {
        providers: applyProvidersDefaults((sections.providers as Partial<ProvidersSchema>) ?? {}),
        models: applyModelsDefaults((sections.models as Partial<ModelsSchema>) ?? {}),
        routing: applyRoutingDefaults((sections.routing as Partial<RoutingSchema>) ?? {}),
        budgets: applyBudgetsDefaults((sections.budgets as Partial<BudgetsSchema>) ?? {}),
        fallback: applyFallbackDefaults((sections.fallback as Partial<FallbackSchema>) ?? {}),
      };

      this.loaded = true;
      this.dirty.clear();
      this.emit("loaded", this.config);
      return ok(this.config);
    } catch (error) {
      const configError = new ConfigError(
        `Failed to load config from ${this.configDir}`,
        { configDir: this.configDir, error: String(error) },
        error instanceof Error ? error : undefined
      );
      return err(configError);
    }
  }

  async save(): Promise<Result<void, ConfigError>> {
    try {
      await mkdir(this.configDir, { recursive: true });
      for (const section of Object.keys(CONFIG_FILE_NAMES) as ConfigSection[]) {
        if (this.dirty.has(section) || !this.loaded) {
          const fileName = CONFIG_FILE_NAMES[section];
          const filePath = join(this.configDir, fileName);
          const content = this.serializeYaml(this.config[section]);
          await writeFile(filePath, content, "utf-8");
        }
      }
      this.dirty.clear();
      this.emit("saved", this.config);
      return ok(undefined);
    } catch (error) {
      const configError = new ConfigError(
        `Failed to save config to ${this.configDir}`,
        { configDir: this.configDir, error: String(error) },
        error instanceof Error ? error : undefined
      );
      return err(configError);
    }
  }

  async reload(): Promise<Result<ConfigData, ConfigError>> {
    this.loaded = false;
    this.config = this.createDefaultConfig();
    const result = await this.load();
    if (result.ok) {
      this.emit("reloaded", result.value);
    }
    return result;
  }

  validate(section?: ConfigSection): Result<void, ValidationError> {
    if (section) {
      const validator = SCHEMA_VALIDATORS[section];
      const result = validator(this.config[section]);
      if (!result.valid) {
        return err(new ValidationError(`Validation failed for ${section}: ${result.errors.join(", ")}`, {
          section,
          errors: result.errors,
        }));
      }
      return ok(undefined);
    }
    const allErrors: string[] = [];
    for (const [sec, validator] of Object.entries(SCHEMA_VALIDATORS)) {
      const result = validator(this.config[sec as ConfigSection]);
      if (!result.valid) {
        allErrors.push(`${sec}: ${result.errors.join(", ")}`);
      }
    }
    if (allErrors.length > 0) {
      return err(new ValidationError(`Validation failed: ${allErrors.join("; ")}`, {
        errors: allErrors,
      }));
    }
    return ok(undefined);
  }

  watch(callback: (config: ConfigData) => void): void {
    this.on("loaded", callback);
    this.on("reloaded", callback);
  }

  merge(section: ConfigSection, partial: Partial<ConfigData[ConfigSection]>): Result<void, ValidationError> {
    const current = this.config[section];
    const merged = { ...current, ...partial };
    const validator = SCHEMA_VALIDATORS[section];
    const validation = validator(merged);
    if (!validation.valid) {
      return err(new ValidationError(`Merge validation failed for ${section}: ${validation.errors.join(", ")}`, {
        section,
        errors: validation.errors,
      }));
    }
    (this.config as unknown as Record<string, unknown>)[section] = merged;
    this.dirty.add(section);
    this.emit("changed", section, merged);
    return ok(undefined);
  }

  exportConfig(): ConfigData {
    return JSON.parse(JSON.stringify(this.config));
  }

  get<K extends ConfigSection>(section: K): ConfigData[K] {
    return this.config[section];
  }

  set<K extends ConfigSection>(section: K, data: ConfigData[K]): Result<void, ValidationError> {
    const validator = SCHEMA_VALIDATORS[section];
    const validation = validator(data);
    if (!validation.valid) {
      return err(new ValidationError(`Set validation failed for ${section}: ${validation.errors.join(", ")}`, {
        section,
        errors: validation.errors,
      }));
    }
    this.config[section] = data;
    this.dirty.add(section);
    this.emit("changed", section, data);
    return ok(undefined);
  }

  has(section: ConfigSection, path?: string): boolean {
    if (!path) {
      return section in this.config;
    }
    const parts = path.split(".");
    let current: unknown = this.config[section];
    for (const part of parts) {
      if (current === null || current === undefined) {
        return false;
      }
      if (typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else {
        return false;
      }
    }
    return current !== undefined;
  }

  getConfigDir(): string {
    return this.configDir;
  }

  private getDefaultForSection(section: ConfigSection): ConfigData[ConfigSection] {
    switch (section) {
      case "providers": return applyProvidersDefaults({});
      case "models": return applyModelsDefaults({});
      case "routing": return applyRoutingDefaults({});
      case "budgets": return applyBudgetsDefaults({});
      case "fallback": return applyFallbackDefaults({});
    }
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  isDirty(): boolean {
    return this.dirty.size > 0;
  }

  private parseYaml(content: string): unknown {
    const lines = content.split("\n");
    const result: Record<string, unknown> = {};
    let currentPath: string[] = [];
    let currentIndent = 0;
    const stack: { path: string[]; indent: number; obj: Record<string, unknown> }[] = [];

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (trimmed === "" || trimmed.startsWith("#")) {
        continue;
      }
      const indent = rawLine.search(/\S/);
      if (indent === -1) {
        continue;
      }
      if (trimmed.startsWith("- ")) {
        continue;
      }
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) {
        continue;
      }
      const key = trimmed.substring(0, colonIdx).trim();
      let value: unknown = trimmed.substring(colonIdx + 1).trim();

      if (value === "") {
        value = {};
      } else if (value === "null" || value === "~") {
        value = null;
      } else if (value === "true") {
        value = true;
      } else if (value === "false") {
        value = false;
      } else if (/^-?\d+$/.test(value as string)) {
        value = parseInt(value as string, 10);
      } else if (/^-?\d+\.\d+$/.test(value as string)) {
        value = parseFloat(value as string);
      } else {
        if ((value as string).startsWith('"') && (value as string).endsWith('"')) {
          value = (value as string).slice(1, -1);
        } else if ((value as string).startsWith("'") && (value as string).endsWith("'")) {
          value = (value as string).slice(1, -1);
        }
      }

      while (stack.length > 0 && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }

      if (stack.length === 0) {
        result[key] = value;
        if (typeof value === "object" && value !== null) {
          stack.push({ path: [key], indent, obj: value as Record<string, unknown> });
        }
      } else {
        const parent = stack[stack.length - 1];
        parent.obj[key] = value;
        if (typeof value === "object" && value !== null) {
          stack.push({ path: [...parent.path, key], indent, obj: value as Record<string, unknown> });
        }
      }
    }

    return result;
  }

  private serializeYaml(data: unknown, indent: number = 0): string {
    if (data === null) {
      return "null";
    }
    if (data === undefined) {
      return "";
    }
    if (typeof data === "string") {
      if (data.includes("\n") || data.includes(":") || data.includes("#")) {
        return `"${data.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
      }
      return data;
    }
    if (typeof data === "number" || typeof data === "boolean") {
      return String(data);
    }
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return "[]";
      }
      const prefix = "  ".repeat(indent);
      return data
        .map((item) => {
          if (typeof item === "object" && item !== null) {
            const inner = this.serializeYaml(item, indent + 1);
            const innerLines = inner.split("\n");
            return `${prefix}- ${innerLines[0]}\n${innerLines.slice(1).join("\n")}`;
          }
          return `${prefix}- ${this.serializeYaml(item, 0)}`;
        })
        .join("\n");
    }
    if (typeof data === "object") {
      const entries = Object.entries(data as Record<string, unknown>);
      if (entries.length === 0) {
        return "{}";
      }
      const prefix = "  ".repeat(indent);
      return entries
        .map(([key, value]) => {
          if (typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value as object).length === 0) {
            return `${prefix}${key}: {}`;
          }
          if (Array.isArray(value) && value.length === 0) {
            return `${prefix}${key}: []`;
          }
          if (typeof value === "object" && value !== null) {
            const inner = this.serializeYaml(value, indent + 1);
            return `${prefix}${key}:\n${inner}`;
          }
          return `${prefix}${key}: ${this.serializeYaml(value, 0)}`;
        })
        .join("\n");
    }
    return String(data);
  }
}
