import type { PluginManifest, Tool } from '@paracosm/shared';
import { ok, err, type Result, createLogger } from '@paracosm/shared';
import { ToolRegistry } from '../tool-registry.js';
import { PLUGIN_DEFAULTS } from '@paracosm/shared';

const logger = createLogger('PluginLoader');

export class PluginLoader {
  private registry: ToolRegistry;
  private loadedPlugins: Map<string, PluginManifest> = new Map();

  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }

  async load(manifest: PluginManifest): Promise<Result<boolean>> {
    if (this.loadedPlugins.has(manifest.id)) {
      return err(new Error(`Plugin ${manifest.id} is already loaded`));
    }
    if (!manifest.enabled) {
      return err(new Error(`Plugin ${manifest.id} is disabled`));
    }
    for (const tool of manifest.tools) {
      const definition = {
        id: tool.id,
        name: tool.name,
        type: tool.type,
        description: tool.description,
        version: tool.version,
        config: tool.config,
        permissions: tool.permissions,
        handler: async () => ({
          toolId: tool.id,
          success: true,
          output: { message: `Plugin tool ${tool.name} executed (mock)` },
          duration: 0,
          metadata: {},
          timestamp: new Date(),
        }),
      };
      const result = this.registry.register(definition);
      if (!result.ok) {
        logger.warn(`Failed to register plugin tool ${tool.id}: ${result.err}`);
      }
    }
    this.loadedPlugins.set(manifest.id, manifest);
    logger.info(`Loaded plugin: ${manifest.name} (${manifest.id})`);
    return ok(true);
  }

  async unload(pluginId: string): Promise<Result<boolean>> {
    const manifest = this.loadedPlugins.get(pluginId);
    if (!manifest) {
      return err(new Error(`Plugin ${pluginId} not found`));
    }
    for (const tool of manifest.tools) {
      this.registry.unregister(tool.id);
    }
    this.loadedPlugins.delete(pluginId);
    logger.info(`Unloaded plugin: ${manifest.name}`);
    return ok(true);
  }

  getLoadedPlugins(): PluginManifest[] {
    return Array.from(this.loadedPlugins.values());
  }

  isLoaded(pluginId: string): boolean {
    return this.loadedPlugins.has(pluginId);
  }

  getPlugin(pluginId: string): PluginManifest | undefined {
    return this.loadedPlugins.get(pluginId);
  }

  clear(): void {
    for (const pluginId of Array.from(this.loadedPlugins.keys())) {
      this.unload(pluginId);
    }
  }
}
