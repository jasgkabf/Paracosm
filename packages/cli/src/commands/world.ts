import { Command } from "commander";
import chalk from "chalk";
import { DEFAULT_PORT } from "@paracosm/shared";
import { formatOutput } from "../utils/output.js";
import { resolveConfig } from "../utils/config-resolver.js";

interface WorldStatusOptions {
  format?: "json" | "table";
}

interface WorldEntitiesOptions {
  type?: string;
  limit?: string;
  offset?: string;
  format?: "json" | "table";
}

interface WorldExportOptions {
  format?: "json" | "yaml";
  output?: string;
  includeRelations?: boolean;
  includeTimeline?: boolean;
  includeGoals?: boolean;
}

interface WorldTimelineOptions {
  from?: string;
  to?: string;
  severity?: string;
  limit?: string;
  format?: "json" | "table";
}

interface WorldGoalsOptions {
  state?: string;
  priority?: string;
  format?: "json" | "table";
}

async function getBaseUrl(): Promise<string> {
  const config = await resolveConfig();
  return `http://localhost:${config.port || DEFAULT_PORT}/api/v1`;
}

async function handleWorldStatus(options: WorldStatusOptions): Promise<void> {
  const baseUrl = await getBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/world-model`);
    if (!response.ok) {
      throw new Error(`Failed to fetch world status (${response.status})`);
    }
    const world = (await response.json()) as Record<string, unknown>;
    formatOutput(world, { format: options.format ?? "table", colorize: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
}

async function handleWorldEntities(options: WorldEntitiesOptions): Promise<void> {
  const baseUrl = await getBaseUrl();
  const params = new URLSearchParams();
  if (options.type) params.set("type", options.type);
  if (options.limit) params.set("limit", options.limit);
  if (options.offset) params.set("offset", options.offset);

  try {
    const response = await fetch(`${baseUrl}/world-model/entities?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch entities (${response.status})`);
    }
    const data = (await response.json()) as {
      entities: Array<Record<string, unknown>>;
      total: number;
    };

    console.log(chalk.blue(`Entities (${data.total} total)`));
    const rows = data.entities.map((entity) => ({
      id: String(entity.id ?? ""),
      name: String(entity.name ?? ""),
      type: String(entity.type ?? ""),
      tags: Array.isArray(entity.tags) ? entity.tags.join(", ") : "",
      createdAt: String(entity.createdAt ?? ""),
    }));

    formatOutput(rows, { format: options.format ?? "table", colorize: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
}

async function handleWorldExport(options: WorldExportOptions): Promise<void> {
  const baseUrl = await getBaseUrl();
  const params = new URLSearchParams();
  params.set("includeRelations", String(options.includeRelations ?? true));
  params.set("includeTimeline", String(options.includeTimeline ?? true));
  params.set("includeGoals", String(options.includeGoals ?? true));

  try {
    const response = await fetch(`${baseUrl}/world-model/export?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to export world (${response.status})`);
    }
    const data = await response.json();

    let output: string;
    if (options.format === "yaml") {
      output = jsonToSimpleYaml(data);
    } else {
      output = JSON.stringify(data, null, 2);
    }

    if (options.output) {
      const fs = await import("node:fs/promises");
      await fs.writeFile(options.output, output, "utf-8");
      console.log(chalk.green(`World exported to ${options.output}`));
    } else {
      console.log(output);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
}

async function handleWorldTimeline(options: WorldTimelineOptions): Promise<void> {
  const baseUrl = await getBaseUrl();
  const params = new URLSearchParams();
  if (options.from) params.set("from", options.from);
  if (options.to) params.set("to", options.to);
  if (options.severity) params.set("severity", options.severity);
  if (options.limit) params.set("limit", options.limit);

  try {
    const response = await fetch(`${baseUrl}/world-model/timeline?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch timeline (${response.status})`);
    }
    const data = (await response.json()) as {
      events: Array<Record<string, unknown>>;
    };

    console.log(chalk.blue("World Timeline"));
    const rows = data.events.map((event) => ({
      id: String(event.id ?? ""),
      name: String(event.name ?? ""),
      severity: String(event.severity ?? ""),
      entity: String(event.entityId ?? ""),
      timestamp: String(event.timestamp ?? ""),
      description: truncate(String(event.description ?? ""), 60),
    }));

    formatOutput(rows, { format: options.format ?? "table", colorize: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
}

async function handleWorldGoals(options: WorldGoalsOptions): Promise<void> {
  const baseUrl = await getBaseUrl();
  const params = new URLSearchParams();
  if (options.state) params.set("state", options.state);
  if (options.priority) params.set("priority", options.priority);

  try {
    const response = await fetch(`${baseUrl}/world-model/goals?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch goals (${response.status})`);
    }
    const data = (await response.json()) as {
      goals: Array<Record<string, unknown>>;
    };

    console.log(chalk.blue("World Goals"));
    const rows = data.goals.map((goal) => ({
      id: String(goal.id ?? ""),
      name: String(goal.name ?? ""),
      priority: String(goal.priority ?? ""),
      state: String(goal.state ?? ""),
      progress: `${Number(goal.progress ?? 0) * 100}%`,
      deadline: goal.deadline ? String(goal.deadline) : "none",
    }));

    formatOutput(rows, { format: options.format ?? "table", colorize: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

function jsonToSimpleYaml(data: unknown, indent = 0): string {
  const prefix = "  ".repeat(indent);
  if (data === null || data === undefined) return "null";
  if (typeof data === "boolean") return data ? "true" : "false";
  if (typeof data === "number") return String(data);
  if (typeof data === "string") {
    if (data.includes("\n") || data.includes(":") || data.includes("#")) {
      return `"${data.replace(/"/g, '\\"')}"`;
    }
    return data;
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return "[]";
    return data.map((item) => `${prefix}- ${jsonToSimpleYaml(item, indent + 1)}`).join("\n");
  }
  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  return entries
    .map(([key, value]) => {
      const val = jsonToSimpleYaml(value, indent + 1);
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        return `${prefix}${key}:\n${val}`;
      }
      return `${prefix}${key}: ${val}`;
    })
    .join("\n");
}

export function registerWorldCommand(program: Command): void {
  const world = program
    .command("world")
    .description("Manage the world model");

  world
    .command("status")
    .description("Show world model status")
    .option("-f, --format <format>", "output format: json, table")
    .action(async (options: WorldStatusOptions) => {
      await handleWorldStatus(options);
    });

  world
    .command("entities")
    .description("List world entities")
    .option("-t, --type <type>", "filter by entity type")
    .option("-l, --limit <number>", "maximum entities to return")
    .option("-o, --offset <number>", "pagination offset")
    .option("-f, --format <format>", "output format: json, table")
    .action(async (options: WorldEntitiesOptions) => {
      await handleWorldEntities(options);
    });

  world
    .command("export")
    .description("Export world model data")
    .option("-f, --format <format>", "output format: json, yaml")
    .option("-o, --output <path>", "output file path")
    .option("--include-relations", "include relations in export", true)
    .option("--include-timeline", "include timeline in export", true)
    .option("--include-goals", "include goals in export", true)
    .action(async (options: WorldExportOptions) => {
      await handleWorldExport(options);
    });

  world
    .command("timeline")
    .description("View world timeline events")
    .option("--from <date>", "start date (ISO format)")
    .option("--to <date>", "end date (ISO format)")
    .option("--severity <level>", "filter by severity: info, warning, critical")
    .option("-l, --limit <number>", "maximum events to return")
    .option("-f, --format <format>", "output format: json, table")
    .action(async (options: WorldTimelineOptions) => {
      await handleWorldTimeline(options);
    });

  world
    .command("goals")
    .description("View and manage world goals")
    .option("-s, --state <state>", "filter by state: pending, active, completed, failed")
    .option("-p, --priority <level>", "filter by priority: critical, high, medium, low")
    .option("-f, --format <format>", "output format: json, table")
    .action(async (options: WorldGoalsOptions) => {
      await handleWorldGoals(options);
    });
}
