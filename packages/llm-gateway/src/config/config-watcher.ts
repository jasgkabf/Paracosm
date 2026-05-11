import { EventEmitter } from "node:events";
import { watch, FSWatcher } from "node:fs";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { Logger } from "@paracosm/shared";
import { CONFIG_FILE_NAMES, DEFAULT_DEBOUNCE_MS, DEFAULT_WATCH_INTERVAL_MS } from "./config-defaults.js";
import type { ConfigManager } from "./config-manager.js";

const logger = new Logger("ConfigWatcher");

export interface ConfigWatchEvent {
  section: string;
  fileName: string;
  timestamp: string;
}

export class ConfigWatcher extends EventEmitter {
  private configDir: string;
  private configManager: ConfigManager;
  private watchers: Map<string, FSWatcher> = new Map();
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private debounceMs: number;
  private watching: boolean = false;
  private lastModified: Map<string, number> = new Map();

  constructor(configManager: ConfigManager, debounceMs: number = DEFAULT_DEBOUNCE_MS) {
    super();
    this.configManager = configManager;
    this.configDir = configManager.getConfigDir();
    this.debounceMs = debounceMs;
  }

  async start(): Promise<void> {
    if (this.watching) {
      return;
    }

    for (const [section, fileName] of Object.entries(CONFIG_FILE_NAMES)) {
      const filePath = join(this.configDir, fileName);
      try {
        await access(filePath);
      } catch {
        logger.warn(`Config file not found, skipping watch: ${filePath}`);
        continue;
      }

      try {
        const watcher = watch(filePath, (eventType) => {
          if (eventType === "change") {
            this.handleFileChange(section, fileName);
          }
        });
        this.watchers.set(section, watcher);
        this.lastModified.set(section, Date.now());
      } catch (error) {
        logger.warn(`Failed to watch config file: ${filePath}`, { error: String(error) });
      }
    }

    this.watching = true;
    this.emit("started");
    logger.info(`Config watcher started for directory: ${this.configDir}`);
  }

  stop(): void {
    for (const [section, watcher] of this.watchers.entries()) {
      watcher.close();
      const timer = this.debounceTimers.get(section);
      if (timer) {
        clearTimeout(timer);
        this.debounceTimers.delete(section);
      }
    }
    this.watchers.clear();
    this.lastModified.clear();
    this.watching = false;
    this.emit("stopped");
    logger.info("Config watcher stopped");
  }

  onChange(callback: (event: ConfigWatchEvent) => void): void {
    this.on("change", callback);
  }

  onError(callback: (error: Error, section: string) => void): void {
    this.on("error", callback);
  }

  isWatching(): boolean {
    return this.watching;
  }

  getWatchedSections(): string[] {
    return Array.from(this.watchers.keys());
  }

  private handleFileChange(section: string, fileName: string): void {
    const existing = this.debounceTimers.get(section);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(section);
      this.applyChange(section, fileName);
    }, this.debounceMs);

    this.debounceTimers.set(section, timer);
  }

  private async applyChange(section: string, fileName: string): Promise<void> {
    try {
      const now = Date.now();
      const lastMod = this.lastModified.get(section) ?? 0;
      if (now - lastMod < this.debounceMs) {
        return;
      }
      this.lastModified.set(section, now);

      const result = await this.configManager.reload();
      if (!result.ok) {
        logger.error(`Failed to reload config after change: ${result.error.message}`);
        this.emit("error", result.error, section);
        return;
      }

      const validation = this.configManager.validate(section as any);
      if (!validation.ok) {
        logger.error(`Config validation failed after change: ${validation.error.message}`);
        this.emit("error", validation.error, section);
        return;
      }

      const event: ConfigWatchEvent = {
        section,
        fileName,
        timestamp: new Date().toISOString(),
      };

      this.emit("change", event);
      logger.info(`Config section ${section} reloaded after file change`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Error processing config change for ${section}: ${err.message}`);
      this.emit("error", err, section);
    }
  }
}
