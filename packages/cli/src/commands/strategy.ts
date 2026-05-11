import { Command } from "commander";
import chalk from "chalk";
import { DEFAULT_PORT } from "@paracosm/shared";
import { formatOutput } from "../utils/output.js";
import { resolveConfig } from "../utils/config-resolver.js";

interface StrategyListOptions {
  generation?: string;
  active?: boolean;
  format?: "json" | "table";
}

interface StrategyEvolveOptions {
  generations?: string;
  mutationRate?: string;
  crossoverRate?: string;
  populationSize?: string;
  dryRun?: boolean;
}

interface StrategyExportOptions {
  format?: "json" | "yaml";
  output?: string;
  generation?: string;
}

interface StrategyAnalyticsOptions {
  period?: "generation" | "session" | "all";
  format?: "json" | "table";
}

interface StrategyCustomOptions {
  name: string;
  type: string;
  condition: string;
  action: string;
  priority?: string;
  weight?: string;
}

async function getBaseUrl(): Promise<string> {
  const config = await resolveConfig();
  return `http://localhost:${config.port || DEFAULT_PORT}/api/v1`;
}

async function handleStrategyList(options: StrategyListOptions): Promise<void> {
  const baseUrl = await getBaseUrl();
  const params = new URLSearchParams();
  if (options.generation) params.set("generation", options.generation);
  if (options.active !== undefined) params.set("active", String(options.active));

  try {
    const response = await fetch(`${baseUrl}/strategy?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch strategies (${response.status})`);
    }
    const data = (await response.json()) as {
      genes: Array<Record<string, unknown>>;
      generation: number;
      totalFitness: number;
      averageFitness: number;
    };

    console.log(chalk.blue(`Strategy Genes (Generation ${data.generation})`));
    console.log(chalk.gray(`Average fitness: ${data.averageFitness.toFixed(4)}, Total fitness: ${data.totalFitness.toFixed(4)}`));
    console.log("");

    const rows = data.genes.map((gene) => ({
      id: String(gene.id ?? "").slice(0, 8),
      name: String(gene.name ?? ""),
      type: String(gene.type ?? ""),
      fitness: Number(gene.fitness ?? 0).toFixed(4),
      generation: String(gene.generation ?? ""),
      active: gene.active ? "yes" : "no",
      origin: String(gene.origin ?? ""),
    }));

    formatOutput(rows, { format: options.format ?? "table", colorize: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
}

async function handleStrategyEvolve(options: StrategyEvolveOptions): Promise<void> {
  const baseUrl = await getBaseUrl();
  const generations = options.generations ? parseInt(options.generations, 10) : 1;
  const mutationRate = options.mutationRate ? parseFloat(options.mutationRate) : 0.1;
  const crossoverRate = options.crossoverRate ? parseFloat(options.crossoverRate) : 0.7;
  const populationSize = options.populationSize ? parseInt(options.populationSize, 10) : 50;

  if (options.dryRun) {
    console.log(chalk.blue("Dry run - evolution parameters:"));
    console.log(`  Generations: ${generations}`);
    console.log(`  Mutation rate: ${mutationRate}`);
    console.log(`  Crossover rate: ${crossoverRate}`);
    console.log(`  Population size: ${populationSize}`);
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/strategy/evolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generations,
        mutationRate,
        crossoverRate,
        populationSize,
      }),
    });

    if (!response.ok) {
      throw new Error(`Evolution failed (${response.status})`);
    }

    const result = (await response.json()) as {
      generation: number;
      bestFitness: number;
      averageFitness: number;
      diversityIndex: number;
      mutationsApplied: number;
      crossoversApplied: number;
      stagnationDetected: boolean;
      duration: number;
    };

    console.log(chalk.green(`Evolution completed in ${result.duration}ms`));
    console.log(`  Generation: ${result.generation}`);
    console.log(`  Best fitness: ${result.bestFitness.toFixed(4)}`);
    console.log(`  Average fitness: ${result.averageFitness.toFixed(4)}`);
    console.log(`  Diversity index: ${result.diversityIndex.toFixed(4)}`);
    console.log(`  Mutations applied: ${result.mutationsApplied}`);
    console.log(`  Crossovers applied: ${result.crossoversApplied}`);
    if (result.stagnationDetected) {
      console.log(chalk.yellow("  Stagnation detected"));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
}

async function handleStrategyExport(options: StrategyExportOptions): Promise<void> {
  const baseUrl = await getBaseUrl();
  const params = new URLSearchParams();
  if (options.generation) params.set("generation", options.generation);

  try {
    const response = await fetch(`${baseUrl}/strategy/export?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to export strategies (${response.status})`);
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
      console.log(chalk.green(`Strategies exported to ${options.output}`));
    } else {
      console.log(output);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
}

async function handleStrategyAnalytics(options: StrategyAnalyticsOptions): Promise<void> {
  const baseUrl = await getBaseUrl();
  const period = options.period ?? "session";

  try {
    const response = await fetch(`${baseUrl}/strategy/analytics?period=${period}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch analytics (${response.status})`);
    }
    const data = (await response.json()) as {
      totalEvaluations: number;
      averageFitness: number;
      bestFitness: number;
      worstFitness: number;
      fitnessOverTime: Array<{ generation: number; fitness: number }>;
      mutationSuccessRate: number;
      crossoverSuccessRate: number;
      stagnationEvents: number;
    };

    console.log(chalk.blue("Strategy Analytics"));
    console.log(`  Total evaluations: ${data.totalEvaluations}`);
    console.log(`  Average fitness: ${data.averageFitness.toFixed(4)}`);
    console.log(`  Best fitness: ${data.bestFitness.toFixed(4)}`);
    console.log(`  Worst fitness: ${data.worstFitness.toFixed(4)}`);
    console.log(`  Mutation success rate: ${(data.mutationSuccessRate * 100).toFixed(1)}%`);
    console.log(`  Crossover success rate: ${(data.crossoverSuccessRate * 100).toFixed(1)}%`);
    console.log(`  Stagnation events: ${data.stagnationEvents}`);

    if (data.fitnessOverTime.length > 0) {
      console.log("");
      console.log(chalk.blue("Fitness Over Time:"));
      const rows = data.fitnessOverTime.map((entry) => ({
        generation: entry.generation,
        fitness: entry.fitness.toFixed(4),
      }));
      formatOutput(rows, { format: options.format ?? "table", colorize: true });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
}

async function handleStrategyCustom(options: StrategyCustomOptions): Promise<void> {
  const baseUrl = await getBaseUrl();
  const priority = options.priority ? parseFloat(options.priority) : 0.5;
  const weight = options.weight ? parseFloat(options.weight) : 1.0;

  try {
    const response = await fetch(`${baseUrl}/strategy/genes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: options.name,
        type: options.type,
        expression: {
          condition: options.condition,
          action: options.action,
          priority,
          weight,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create custom strategy (${response.status})`);
    }

    const result = (await response.json()) as { id: string; name: string };
    console.log(chalk.green(`Custom strategy created: ${result.name} (${result.id})`));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
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

export function registerStrategyCommand(program: Command): void {
  const strategy = program
    .command("strategy")
    .description("Manage strategy evolution and genes");

  strategy
    .command("list")
    .description("List strategy genes")
    .option("-g, --generation <number>", "filter by generation")
    .option("--active", "show only active genes")
    .option("-f, --format <format>", "output format: json, table")
    .action(async (options: StrategyListOptions) => {
      await handleStrategyList(options);
    });

  strategy
    .command("evolve")
    .description("Run strategy evolution")
    .option("-g, --generations <number>", "number of generations")
    .option("--mutation-rate <rate>", "mutation rate (0-1)")
    .option("--crossover-rate <rate>", "crossover rate (0-1)")
    .option("--population-size <size>", "population size")
    .option("--dry-run", "preview without executing")
    .action(async (options: StrategyEvolveOptions) => {
      await handleStrategyEvolve(options);
    });

  strategy
    .command("export")
    .description("Export strategy data")
    .option("-f, --format <format>", "output format: json, yaml")
    .option("-o, --output <path>", "output file path")
    .option("-g, --generation <number>", "export specific generation")
    .action(async (options: StrategyExportOptions) => {
      await handleStrategyExport(options);
    });

  strategy
    .command("analytics")
    .description("View strategy evolution analytics")
    .option("-p, --period <period>", "time period: generation, session, all")
    .option("-f, --format <format>", "output format: json, table")
    .action(async (options: StrategyAnalyticsOptions) => {
      await handleStrategyAnalytics(options);
    });

  strategy
    .command("custom")
    .description("Create a custom strategy gene")
    .argument("<name>", "gene name")
    .argument("<type>", "gene type: heuristic, rule, pattern, policy, procedure")
    .argument("<condition>", "trigger condition expression")
    .argument("<action>", "action to execute")
    .option("--priority <number>", "gene priority (0-1)")
    .option("--weight <number>", "gene weight")
    .action(async (name: string, type: string, condition: string, action: string, opts: StrategyCustomOptions) => {
      await handleStrategyCustom({ ...opts, name, type, condition, action });
    });
}
