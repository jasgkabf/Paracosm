import type { PluginManifest } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('PluginMarket');

export class PluginMarket {
  private availablePlugins: Map<string, PluginManifest> = new Map();

  register(manifest: PluginManifest): void {
    this.availablePlugins.set(manifest.id, manifest);
    logger.info(`Plugin registered in market: ${manifest.name}`);
  }

  unregister(pluginId: string): void {
    this.availablePlugins.delete(pluginId);
  }

  search(query: string): PluginManifest[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.availablePlugins.values()).filter(
      (p) => p.name.toLowerCase().includes(lowerQuery) || p.description.toLowerCase().includes(lowerQuery),
    );
  }

  get(pluginId: string): PluginManifest | undefined {
    return this.availablePlugins.get(pluginId);
  }

  getAll(): PluginManifest[] {
    return Array.from(this.availablePlugins.values());
  }

  getByAuthor(author: string): PluginManifest[] {
    return Array.from(this.availablePlugins.values()).filter((p) => p.author === author);
  }

  clear(): void {
    this.availablePlugins.clear();
  }
}
