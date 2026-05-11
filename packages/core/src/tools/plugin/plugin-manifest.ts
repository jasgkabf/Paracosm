import type { PluginManifest } from '@paracosm/shared';
import { generateId, createLogger } from '@paracosm/shared';

const logger = createLogger('PluginManifest');

export function createPluginManifest(data: {
  name: string;
  version: string;
  description: string;
  author: string;
  entryPoint: string;
  enabled?: boolean;
  dependencies?: Record<string, string>;
}): PluginManifest {
  return {
    id: generateId(),
    name: data.name,
    version: data.version,
    description: data.description,
    author: data.author,
    tools: [],
    mcpConfigs: [],
    dependencies: data.dependencies ?? {},
    permissions: [],
    entryPoint: data.entryPoint,
    enabled: data.enabled ?? true,
    installedAt: new Date(),
    metadata: {},
  };
}

export function validateManifest(manifest: Partial<PluginManifest>): string[] {
  const errors: string[] = [];
  if (!manifest.name) errors.push('Plugin name is required');
  if (!manifest.version) errors.push('Plugin version is required');
  if (!manifest.description) errors.push('Plugin description is required');
  if (!manifest.author) errors.push('Plugin author is required');
  if (!manifest.entryPoint) errors.push('Plugin entry point is required');
  if (manifest.tools && !Array.isArray(manifest.tools)) errors.push('Plugin tools must be an array');
  return errors;
}
