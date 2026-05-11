import fs from 'node:fs';
import path from 'node:path';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('ConfigStore');

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

const DEFAULT_CONFIG: LLMConfig = {
  apiKey: '',
  baseUrl: '',
  model: '',
};

export class ConfigStore {
  private configPath: string;
  private config: LLMConfig;

  constructor(dataDir: string) {
    this.configPath = path.join(dataDir, 'llm-config.json');
    this.config = { ...DEFAULT_CONFIG };
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.config = { ...DEFAULT_CONFIG, ...parsed };
        logger.info('LLM config loaded from file');
      }
    } catch (error) {
      logger.warn('Failed to load config, using defaults', { error: (error as Error).message });
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
      logger.info('LLM config saved to file');
    } catch (error) {
      logger.error('Failed to save config', { error: (error as Error).message });
    }
  }

  getConfig(): LLMConfig {
    return {
      apiKey: this.maskApiKey(this.config.apiKey),
      baseUrl: this.config.baseUrl,
      model: this.config.model,
    };
  }

  getRawConfig(): LLMConfig {
    return { ...this.config };
  }

  isConfigured(): boolean {
    return !!(this.config.apiKey && this.config.baseUrl && this.config.model);
  }

  saveConfig(config: Partial<LLMConfig>): LLMConfig {
    if (config.apiKey !== undefined) this.config.apiKey = config.apiKey;
    if (config.baseUrl !== undefined) this.config.baseUrl = config.baseUrl;
    if (config.model !== undefined) this.config.model = config.model;
    this.save();
    return this.getConfig();
  }

  deleteConfig(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.save();
    logger.info('LLM config reset');
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) {
      return { success: false, message: 'LLM is not configured. Please set apiKey, baseUrl, and model.' };
    }

    try {
      const url = `${this.config.baseUrl}/chat/completions`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return { success: true, message: `Connection successful. Model: ${this.config.model}` };
      } else {
        const body = await response.text();
        return { success: false, message: `API returned ${response.status}: ${body.slice(0, 200)}` };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Connection failed: ${msg}` };
    }
  }

  private maskApiKey(key: string): string {
    if (!key) return '';
    if (key.length <= 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
  }
}
