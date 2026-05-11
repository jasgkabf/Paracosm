import type { PluginManifest as SharedPluginManifest } from "@paracosm/shared";
import { ToolError, generateId } from "@paracosm/shared";
import type { PluginState, ValidationResult } from "../types.js";
import type { Manifest, ResolvedManifest } from "./plugin-manifest.js";
import { PluginManifestParser } from "./plugin-manifest.js";
import { ToolRegistry } from "../tool-registry.js";
import { ToolSandbox, type Sandbox } from "../tool-sandbox.js";
import type { SandboxConfig } from "../types.js";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";

export interface Plugin {
  id: string;
  manifest: Manifest;
  state: PluginState;
  sandbox: Sandbox | null;
  module: unknown;
}

export class PluginLoader {
  private registry: ToolRegistry;
  private sandboxManager: ToolSandbox;
  private manifestParser: PluginManifestParser;
  private loadedPlugins: Map<string, Plugin> = new Map();
  private pluginPaths: Map<string, string> = new Map();
  private coreVersion: string;

  constructor(
    registry: ToolRegistry,
    sandboxManager: ToolSandbox,
    coreVersion: string = "0.1.0"
  ) {
    this.registry = registry;
    this.sandboxManager = sandboxManager;
    this.manifestParser = new PluginManifestParser(coreVersion);
    this.coreVersion = coreVersion;
  }

  async load(path: string): Promise<Plugin> {
    const resolvedPath = resolve(path);
    if (!existsSync(resolvedPath)) {
      throw new ToolError(`Plugin path does not exist: ${resolvedPath}`, { path: resolvedPath });
    }
    const pathStat = await stat(resolvedPath);
    let manifestPath: string;
    let modulePath: string;
    if (pathStat.isDirectory()) {
      manifestPath = join(resolvedPath, "manifest.json");
      modulePath = resolvedPath;
    } else {
      manifestPath = resolvedPath;
      modulePath = resolve(resolvedPath, "..");
    }
    if (!existsSync(manifestPath)) {
      throw new ToolError(`Plugin manifest not found at: ${manifestPath}`, { path: manifestPath });
    }
    const rawManifest = await readFile(manifestPath, "utf-8");
    let parsedManifest: unknown;
    try {
      parsedManifest = JSON.parse(rawManifest);
    } catch {
      throw new ToolError(`Invalid JSON in plugin manifest: ${manifestPath}`, { path: manifestPath });
    }
    const manifest = this.manifestParser.parse(parsedManifest);
    const validation = this.validate(manifest);
    if (!validation.valid) {
      throw new ToolError(
        `Plugin manifest validation failed: ${validation.errors.join(", ")}`,
        { path: manifestPath, errors: validation.errors }
      );
    }
    if (!this.manifestParser.versionCheck(manifest, this.coreVersion)) {
      throw new ToolError(
        `Plugin "${manifest.id}" is not compatible with core version ${this.coreVersion}`,
        { pluginId: manifest.id, coreVersion: this.coreVersion, minVersion: manifest.minAppVersion }
      );
    }
    if (this.loadedPlugins.has(manifest.id)) {
      throw new ToolError(`Plugin "${manifest.id}" is already loaded`, { pluginId: manifest.id });
    }
    const deps = this.resolveDependencies(manifest);
    for (const depId of deps) {
      if (!this.loadedPlugins.has(depId)) {
        throw new ToolError(
          `Plugin "${manifest.id}" requires dependency "${depId}" which is not loaded`,
          { pluginId: manifest.id, dependencyId: depId }
        );
      }
    }
    let pluginModule: unknown = null;
    const moduleFilePath = join(modulePath, manifest.main);
    if (existsSync(moduleFilePath)) {
      try {
        pluginModule = await import(moduleFilePath);
      } catch (importError) {
        pluginModule = null;
      }
    }
    const pluginSandbox = this.sandbox(manifest);
    const pluginState: PluginState = {
      id: manifest.id,
      manifest,
      config: {
        pluginId: manifest.id,
        enabled: true,
        settings: {},
        priority: 0,
        toolOverrides: {},
      },
      status: "active",
      loadedAt: new Date().toISOString(),
      errorCount: 0,
      lastError: null,
      sandboxId: pluginSandbox?.id ?? null,
    };
    const plugin: Plugin = {
      id: manifest.id,
      manifest,
      state: pluginState,
      sandbox: pluginSandbox,
      module: pluginModule,
    };
    this.loadedPlugins.set(manifest.id, plugin);
    this.pluginPaths.set(manifest.id, resolvedPath);
    return plugin;
  }

  unload(id: string): void {
    const plugin = this.loadedPlugins.get(id);
    if (!plugin) {
      return;
    }
    if (plugin.sandbox) {
      this.sandboxManager.cleanup(plugin.sandbox);
    }
    plugin.state.status = "unloaded";
    this.loadedPlugins.delete(id);
    this.pluginPaths.delete(id);
  }

  validate(manifest: Manifest): ValidationResult {
    return this.manifestParser.validate(manifest);
  }

  sandbox(manifest: Manifest): Sandbox | null {
    const hasDangerousPermissions = manifest.permissions.some(
      (p) => p === "admin" || p === "execute" || p === "file_system"
    );
    if (hasDangerousPermissions) {
      const config: SandboxConfig = {
        maxMemoryBytes: 64 * 1024 * 1024,
        maxCpuTimeMs: 30000,
        maxExecutionTimeMs: 60000,
        maxFileSizeBytes: 5 * 1024 * 1024,
        allowNetwork: false,
        allowFileSystem: false,
        allowSubprocess: false,
        environmentVariables: {},
        allowedModules: [],
        blockedModules: ["child_process", "fs", "net", "http", "https", "os"],
      };
      return this.sandboxManager.create(config);
    }
    const config: SandboxConfig = {
      maxMemoryBytes: 128 * 1024 * 1024,
      maxCpuTimeMs: 60000,
      maxExecutionTimeMs: 120000,
      maxFileSizeBytes: 10 * 1024 * 1024,
      allowNetwork: true,
      allowFileSystem: true,
      allowSubprocess: false,
      environmentVariables: {},
      allowedModules: [],
      blockedModules: ["child_process"],
    };
    return this.sandboxManager.create(config);
  }

  async hotReload(id: string, path?: string): Promise<void> {
    const existingPlugin = this.loadedPlugins.get(id);
    if (!existingPlugin) {
      throw new ToolError(`Plugin "${id}" is not loaded, cannot hot reload`, { pluginId: id });
    }
    const pluginPath = path ?? this.pluginPaths.get(id);
    if (!pluginPath) {
      throw new ToolError(`Cannot determine path for plugin "${id}"`, { pluginId: id });
    }
    this.unload(id);
    try {
      await this.load(pluginPath);
    } catch (error) {
      throw new ToolError(
        `Hot reload failed for plugin "${id}": ${error instanceof Error ? error.message : String(error)}`,
        { pluginId: id, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  resolveDependencies(manifest: Manifest): string[] {
    const deps: string[] = [];
    if (manifest.dependencies) {
      for (const dep of manifest.dependencies) {
        if (!dep.optional) {
          deps.push(dep.pluginId);
        }
      }
    }
    return deps;
  }

  getPlugin(id: string): Plugin | undefined {
    return this.loadedPlugins.get(id);
  }

  getLoadedPlugins(): Plugin[] {
    return Array.from(this.loadedPlugins.values());
  }

  getActivePlugins(): Plugin[] {
    return Array.from(this.loadedPlugins.values()).filter((p) => p.state.status === "active");
  }

  getPluginState(id: string): PluginState | undefined {
    return this.loadedPlugins.get(id)?.state;
  }
}
