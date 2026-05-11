import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const CONFIG_DIR = join(process.env.HOME ?? '~', '.paracosm');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

interface ResolvedConfig {
  apiUrl: string;
  wsUrl: string;
  defaultProvider: string;
  defaultModel: string;
  providers: Array<{
    provider: string;
    apiKey: string;
    baseUrl?: string;
    models: string[];
  }>;
  routing: string;
  budget: {
    dailyLimit: number;
    monthlyLimit: number;
  };
}

const DEFAULT_CONFIG: ResolvedConfig = {
  apiUrl: 'http://localhost:7529/api/v1',
  wsUrl: 'ws://localhost:7529/api/v1/ws',
  defaultProvider: 'openai',
  defaultModel: 'gpt-4o',
  providers: [],
  routing: 'adaptive',
  budget: {
    dailyLimit: 10,
    monthlyLimit: 100,
  },
};

export async function resolveConfig(): Promise<ResolvedConfig> {
  const configPath = process.env.PARACOSM_CONFIG ?? CONFIG_FILE;

  try {
    const raw = await readFile(configPath, 'utf-8');
    const fileConfig = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...fileConfig };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: Partial<ResolvedConfig>): Promise<void> {
  const configPath = process.env.PARACOSM_CONFIG ?? CONFIG_FILE;
  const dir = join(configPath, '..');

  try {
    await mkdir(dir, { recursive: true });
  } catch {}

  const current = await resolveConfig();
  const merged = { ...current, ...config };

  await writeFile(configPath, JSON.stringify(merged, null, 2), 'utf-8');
}
