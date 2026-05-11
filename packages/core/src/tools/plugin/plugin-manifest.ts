import type { PluginManifest as SharedPluginManifest } from "@paracosm/shared";
import type { ValidationResult } from "../types.js";
import { ToolRegistry } from "../tool-registry.js";

export interface Manifest extends SharedPluginManifest {
  resolvedAt: string;
  checksum: string | null;
  source: string;
}

export interface ResolvedManifest extends Manifest {
  resolvedTools: Array<{
    toolId: string;
    available: boolean;
    version: string;
  }>;
  resolvedDependencies: Array<{
    pluginId: string;
    available: boolean;
    version: string | null;
    requiredVersion: string;
    optional: boolean;
  }>;
  compatible: boolean;
  warnings: string[];
}

export class PluginManifestParser {
  private coreVersion: string;

  constructor(coreVersion: string = "0.1.0") {
    this.coreVersion = coreVersion;
  }

  parse(raw: unknown): Manifest {
    if (raw === null || raw === undefined || typeof raw !== "object") {
      throw new Error("Manifest must be a non-null object");
    }
    const obj = raw as Record<string, unknown>;
    const requiredFields = ["id", "name", "version", "description", "author", "license", "main"];
    for (const field of requiredFields) {
      if (!obj[field] || typeof obj[field] !== "string") {
        throw new Error(`Manifest missing required field: ${field}`);
      }
    }
    const manifest: Manifest = {
      id: String(obj.id),
      name: String(obj.name),
      version: String(obj.version),
      description: String(obj.description),
      author: String(obj.author),
      license: String(obj.license),
      main: String(obj.main),
      tools: Array.isArray(obj.tools) ? (obj.tools as unknown as string[]) as any : [],
      dependencies: Array.isArray(obj.dependencies) ? (obj.dependencies as Array<Record<string, unknown>>).map((dep) => ({
        pluginId: String(dep.pluginId ?? ""),
        version: String(dep.version ?? ""),
        optional: Boolean(dep.optional ?? false),
      })) : [],
      permissions: Array.isArray(obj.permissions) ? obj.permissions as any[] : [],
      configSchema: (obj.configSchema as Record<string, unknown>) ?? {},
      minAppVersion: String(obj.minAppVersion ?? "0.0.0"),
      maxAppVersion: obj.maxAppVersion ? String(obj.maxAppVersion) : null,
      resolvedAt: new Date().toISOString(),
      checksum: obj.checksum ? String(obj.checksum) : null,
      source: String(obj.source ?? "unknown"),
    };
    return manifest;
  }

  validate(manifest: Manifest): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!manifest.id || !/^[a-zA-Z0-9_-]+$/.test(manifest.id)) {
      errors.push("Manifest id must contain only alphanumeric characters, underscores, and hyphens");
    }
    if (!manifest.name || manifest.name.trim().length === 0) {
      errors.push("Manifest name must be a non-empty string");
    }
    if (!this.isValidSemver(manifest.version)) {
      errors.push("Manifest version must follow semver format (e.g., 1.0.0)");
    }
    if (!manifest.description || manifest.description.trim().length === 0) {
      warnings.push("Manifest description is empty");
    }
    if (!manifest.author || manifest.author.trim().length === 0) {
      errors.push("Manifest author must be specified");
    }
    if (!manifest.license || manifest.license.trim().length === 0) {
      warnings.push("Manifest license is not specified");
    }
    if (!manifest.main || manifest.main.trim().length === 0) {
      errors.push("Manifest main entry point must be specified");
    }
    if (manifest.dependencies) {
      for (const dep of manifest.dependencies) {
        if (!dep.pluginId || dep.pluginId.trim().length === 0) {
          errors.push("Dependency must have a non-empty pluginId");
        }
        if (!dep.version || !this.isValidSemver(dep.version)) {
          errors.push(`Dependency "${dep.pluginId}" must have a valid semver version`);
        }
      }
    }
    if (manifest.tools && !Array.isArray(manifest.tools)) {
      errors.push("Manifest tools must be an array");
    }
    if (manifest.minAppVersion && !this.isValidSemver(manifest.minAppVersion)) {
      errors.push("minAppVersion must be a valid semver version");
    }
    if (manifest.maxAppVersion && !this.isValidSemver(manifest.maxAppVersion)) {
      errors.push("maxAppVersion must be a valid semver version");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  resolve(manifest: Manifest, registry: ToolRegistry): ResolvedManifest {
    const resolvedTools: ResolvedManifest["resolvedTools"] = [];
    const resolvedDeps: ResolvedManifest["resolvedDependencies"] = [];
    const warnings: string[] = [];

    for (const toolId of manifest.tools) {
      const tool = registry.get(toolId);
      resolvedTools.push({
        toolId,
        available: tool !== undefined,
        version: tool?.version ?? "0.0.0",
      });
      if (!tool) {
        warnings.push(`Tool "${toolId}" is not available in the registry`);
      }
    }

    for (const dep of manifest.dependencies) {
      resolvedDeps.push({
        pluginId: dep.pluginId,
        available: false,
        version: null,
        requiredVersion: dep.version,
        optional: dep.optional,
      });
    }

    const versionCompatible = this.versionCheck(manifest, this.coreVersion);

    return {
      ...manifest,
      resolvedTools,
      resolvedDependencies: resolvedDeps,
      compatible: versionCompatible && resolvedTools.every((t) => t.available),
      warnings,
    };
  }

  versionCheck(manifest: Manifest, coreVersion: string): boolean {
    if (manifest.minAppVersion) {
      if (this.compareSemver(coreVersion, manifest.minAppVersion) < 0) {
        return false;
      }
    }
    if (manifest.maxAppVersion) {
      if (this.compareSemver(coreVersion, manifest.maxAppVersion) > 0) {
        return false;
      }
    }
    return true;
  }

  private isValidSemver(version: string): boolean {
    return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version);
  }

  private compareSemver(a: string, b: string): number {
    const parseVersion = (v: string) => {
      const match = v.match(/^(\d+)\.(\d+)\.(\d+)/);
      if (!match) return [0, 0, 0];
      return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
    };
    const aParts = parseVersion(a);
    const bParts = parseVersion(b);
    for (let i = 0; i < 3; i++) {
      if (aParts[i] > bParts[i]) return 1;
      if (aParts[i] < bParts[i]) return -1;
    }
    return 0;
  }
}
