import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const APP_DIR = '.paracosm';

function getBaseDir(): string {
  return homedir();
}

export function getConfigDir(): string {
  const dir = join(getBaseDir(), APP_DIR, 'config');
  ensureDir(dir);
  return dir;
}

export function getDataDir(): string {
  const dir = join(getBaseDir(), APP_DIR, 'data');
  ensureDir(dir);
  return dir;
}

export function getCacheDir(): string {
  const dir = join(getBaseDir(), APP_DIR, 'cache');
  ensureDir(dir);
  return dir;
}

export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}
