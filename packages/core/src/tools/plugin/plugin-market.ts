import { ToolError, generateId } from "@paracosm/shared";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, stat, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";

export interface PluginListing {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  downloads: number;
  rating: number;
  tags: string[];
  lastUpdated: string;
}

interface InstalledPlugin {
  id: string;
  name: string;
  version: string;
  installedAt: string;
  installPath: string;
  checksum: string;
}

export class PluginMarket {
  private registryUrl: string;
  private installDir: string;
  private installedPlugins: Map<string, InstalledPlugin> = new Map();
  private cacheDir: string;

  constructor(registryUrl: string = "https://plugins.paracosm.dev", installDir: string = "./plugins") {
    this.registryUrl = registryUrl;
    this.installDir = resolve(installDir);
    this.cacheDir = join(this.installDir, ".cache");
  }

  search(query: string): PluginListing[] {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) {
      return this.getMockListings();
    }
    const terms = normalizedQuery.split(/\s+/);
    const listings = this.getMockListings();
    return listings
      .map((listing) => {
        let score = 0;
        const nameLower = listing.name.toLowerCase();
        const descLower = listing.description.toLowerCase();
        for (const term of terms) {
          if (nameLower.includes(term)) score += 5;
          if (descLower.includes(term)) score += 2;
          for (const tag of listing.tags) {
            if (tag.toLowerCase().includes(term)) score += 3;
          }
          if (listing.author.toLowerCase().includes(term)) score += 1;
        }
        return { listing, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.listing);
  }

  async install(name: string, version?: string): Promise<void> {
    const listing = this.findListing(name);
    if (!listing) {
      throw new ToolError(`Plugin "${name}" not found in marketplace`, { name, version });
    }
    const targetVersion = version ?? listing.version;
    const pluginDir = join(this.installDir, listing.id);
    if (!existsSync(pluginDir)) {
      await mkdir(pluginDir, { recursive: true });
    }
    const manifestContent = JSON.stringify({
      id: listing.id,
      name: listing.name,
      version: targetVersion,
      description: listing.description,
      author: listing.author,
      license: "MIT",
      main: "index.js",
      tools: [],
      dependencies: [],
      permissions: [],
      configSchema: {},
      minAppVersion: "0.1.0",
      maxAppVersion: null,
    }, null, 2);
    const manifestPath = join(pluginDir, "manifest.json");
    await writeFile(manifestPath, manifestContent, "utf-8");
    const indexPath = join(pluginDir, "index.js");
    const indexContent = `// Plugin: ${listing.name} v${targetVersion}\nmodule.exports = { name: "${listing.name}", version: "${targetVersion}" };\n`;
    await writeFile(indexPath, indexContent, "utf-8");
    const checksum = this.computeChecksum(manifestContent + indexContent);
    const installed: InstalledPlugin = {
      id: listing.id,
      name: listing.name,
      version: targetVersion,
      installedAt: new Date().toISOString(),
      installPath: pluginDir,
      checksum,
    };
    this.installedPlugins.set(listing.id, installed);
  }

  async update(name: string): Promise<void> {
    const installed = this.installedPlugins.get(name);
    if (!installed) {
      throw new ToolError(`Plugin "${name}" is not installed`, { name });
    }
    const listing = this.findListing(name);
    if (!listing) {
      throw new ToolError(`Plugin "${name}" not found in marketplace`, { name });
    }
    if (listing.version === installed.version) {
      return;
    }
    await this.uninstall(name);
    await this.install(name, listing.version);
  }

  async uninstall(name: string): Promise<void> {
    const installed = this.installedPlugins.get(name);
    if (!installed) {
      throw new ToolError(`Plugin "${name}" is not installed`, { name });
    }
    const pluginDir = installed.installPath;
    if (existsSync(pluginDir)) {
      try {
        const manifestPath = join(pluginDir, "manifest.json");
        if (existsSync(manifestPath)) await unlink(manifestPath);
        const indexPath = join(pluginDir, "index.js");
        if (existsSync(indexPath)) await unlink(indexPath);
      } catch {
        // best effort cleanup
      }
    }
    this.installedPlugins.delete(name);
  }

  verify(name: string, checksum: string): boolean {
    const installed = this.installedPlugins.get(name);
    if (!installed) {
      return false;
    }
    return installed.checksum === checksum;
  }

  getInstalledPlugins(): InstalledPlugin[] {
    return Array.from(this.installedPlugins.values());
  }

  isInstalled(name: string): boolean {
    return this.installedPlugins.has(name);
  }

  private findListing(name: string): PluginListing | undefined {
    return this.getMockListings().find(
      (l) => l.id === name || l.name.toLowerCase() === name.toLowerCase()
    );
  }

  private computeChecksum(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  private getMockListings(): PluginListing[] {
    return [
      {
        id: "paracosm-git",
        name: "Git Integration",
        version: "1.2.0",
        description: "Git version control integration for Paracosm projects",
        author: "paracosm-team",
        downloads: 15420,
        rating: 4.7,
        tags: ["git", "version-control", "scm"],
        lastUpdated: "2025-03-15T10:00:00Z",
      },
      {
        id: "paracosm-docker",
        name: "Docker Manager",
        version: "2.0.1",
        description: "Docker container management and orchestration plugin",
        author: "paracosm-team",
        downloads: 12300,
        rating: 4.5,
        tags: ["docker", "containers", "devops"],
        lastUpdated: "2025-04-01T08:00:00Z",
      },
      {
        id: "paracosm-testing",
        name: "Testing Framework",
        version: "3.1.0",
        description: "Comprehensive testing framework with coverage reporting",
        author: "paracosm-team",
        downloads: 22100,
        rating: 4.8,
        tags: ["testing", "coverage", "quality"],
        lastUpdated: "2025-02-20T12:00:00Z",
      },
      {
        id: "paracosm-monitoring",
        name: "System Monitor",
        version: "1.0.5",
        description: "Real-time system monitoring and alerting plugin",
        author: "community-dev",
        downloads: 8900,
        rating: 4.3,
        tags: ["monitoring", "alerts", "observability"],
        lastUpdated: "2025-01-10T14:00:00Z",
      },
      {
        id: "paracosm-ai-tools",
        name: "AI Toolkit",
        version: "0.9.2",
        description: "Additional AI-powered tools for content generation and analysis",
        author: "ai-labs",
        downloads: 31200,
        rating: 4.9,
        tags: ["ai", "generation", "nlp"],
        lastUpdated: "2025-04-05T16:00:00Z",
      },
    ];
  }
}
