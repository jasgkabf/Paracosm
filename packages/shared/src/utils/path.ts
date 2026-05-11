import { join, resolve, isAbsolute as pathIsAbsolute } from "node:path";
import { homedir, platform } from "node:os";
import { mkdir } from "node:fs/promises";

function getAppName(): string {
  return "paracosm";
}

function getXdgDir(envVar: string, fallback: string): string {
  const envValue = process.env[envVar];
  if (envValue) {
    return envValue;
  }
  return join(homedir(), fallback);
}

export function getConfigDir(): string {
  const plat = platform();
  if (plat === "win32") {
    const appData = process.env.APPDATA;
    if (appData) {
      return join(appData, getAppName());
    }
    return join(homedir(), "AppData", "Roaming", getAppName());
  }
  if (plat === "darwin") {
    return join(homedir(), "Library", "Application Support", getAppName());
  }
  return getXdgDir("XDG_CONFIG_HOME", join(".config", getAppName()));
}

export function getDataDir(): string {
  const plat = platform();
  if (plat === "win32") {
    const appData = process.env.APPDATA;
    if (appData) {
      return join(appData, getAppName(), "Data");
    }
    return join(homedir(), "AppData", "Roaming", getAppName(), "Data");
  }
  if (plat === "darwin") {
    return join(homedir(), "Library", "Application Support", getAppName(), "Data");
  }
  return getXdgDir("XDG_DATA_HOME", join(".local", "share", getAppName()));
}

export function getCacheDir(): string {
  const plat = platform();
  if (plat === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      return join(localAppData, getAppName(), "Cache");
    }
    return join(homedir(), "AppData", "Local", getAppName(), "Cache");
  }
  if (plat === "darwin") {
    return join(homedir(), "Library", "Caches", getAppName());
  }
  return getXdgDir("XDG_CACHE_HOME", join(".cache", getAppName()));
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export function resolvePath(...segments: string[]): string {
  return resolve(...segments);
}

export function isAbsolute(path: string): boolean {
  return pathIsAbsolute(path);
}
