import { Command } from "commander";
import chalk from "chalk";
import { DEFAULT_PORT, APP_NAME, APP_VERSION } from "@paracosm/shared";
import { formatOutput } from "../utils/output.js";
import { resolveConfig } from "../utils/config-resolver.js";
import { isRunning, getDaemonPid } from "../utils/process-manager.js";

interface StatusOptions {
  format?: "json" | "text";
  verbose?: boolean;
}

interface HealthOptions {
  format?: "json" | "text";
  timeout?: string;
}

interface UsageOptions {
  period?: "day" | "week" | "month";
  format?: "json" | "table";
}

interface ConnectionsOptions {
  format?: "json" | "table";
}

async function getBaseUrl(): Promise<string> {
  const config = await resolveConfig();
  return `http://localhost:${config.port || DEFAULT_PORT}/api/v1`;
}

async function handleStatus(options: StatusOptions): Promise<void> {
  const config = await resolveConfig();
  const port = config.port || DEFAULT_PORT;
  const running = await isRunning();
  const pid = running ? await getDaemonPid() : null;

  const status = {
    app: APP_NAME,
    version: APP_VERSION,
    status: running ? "running" : "stopped",
    pid: pid ?? null,
    port,
    host: config.host ?? "0.0.0.0",
    environment: config.app?.environment ?? "development",
    logLevel: config.app?.logLevel ?? "info",
  };

  if (running) {
    try {
      const baseUrl = await getBaseUrl();
      const response = await fetch(`${baseUrl}/heartbeat`);
      if (response.ok) {
        const data = (await response.json()) as Record<string, unknown>;
        status.uptime = data.uptime ?? "N/A";
        status.memoryUsage = data.memoryUsage ?? "N/A";
      }
    } catch {
      status.status = "unresponsive";
    }
  }

  if (options.format === "json") {
    formatOutput(status, { format: "json", colorize: true });
  } else {
    console.log(chalk.blue(`${APP_NAME} v${APP_VERSION}`));
    console.log(`  Status: ${running ? chalk.green("running") : chalk.red("stopped")}`);
    if (pid) console.log(`  PID: ${pid}`);
    console.log(`  Port: ${port}`);
    console.log(`  Host: ${status.host}`);
    console.log(`  Environment: ${status.environment}`);
    console.log(`  Log level: ${status.logLevel}`);
    if (status.uptime) console.log(`  Uptime: ${status.uptime}`);
    if (status.memoryUsage) console.log(`  Memory: ${status.memoryUsage}`);
  }
}

async function handleHealth(options: HealthOptions): Promise<void> {
  const baseUrl = await getBaseUrl();
  const timeout = options.timeout ? parseInt(options.timeout, 10) : 5000;
  const checks: Array<{ name: string; status: string; latency?: number; detail?: string }> = [];

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(`${baseUrl}/heartbeat`, { signal: controller.signal });
    clearTimeout(timer);
    const latency = Date.now() - start;

    if (response.ok) {
      checks.push({ name: "server", status: "healthy", latency });
    } else {
      checks.push({ name: "server", status: "degraded", latency, detail: `HTTP ${response.status}` });
    }
  } catch {
    checks.push({ name: "server", status: "unhealthy", detail: "Connection refused" });
  }

  try {
    const response = await fetch(`${baseUrl}/llm-config/providers`);
    if (response.ok) {
      const data = (await response.json()) as Array<Record<string, unknown>>;
      const enabled = data.filter((p) => p.enabled).length;
      checks.push({ name: "providers", status: enabled > 0 ? "healthy" : "degraded", detail: `${enabled}/${data.length} enabled` });
    } else {
      checks.push({ name: "providers", status: "unknown" });
    }
  } catch {
    checks.push({ name: "providers", status: "unreachable" });
  }

  try {
    const response = await fetch(`${baseUrl}/world-model`);
    if (response.ok) {
      const data = (await response.json()) as Record<string, unknown>;
      checks.push({ name: "world-model", status: "healthy", detail: `v${data.version ?? "?"}` });
    } else {
      checks.push({ name: "world-model", status: "degraded" });
    }
  } catch {
    checks.push({ name: "world-model", status: "unreachable" });
  }

  try {
    const response = await fetch(`${baseUrl}/tools`);
    if (response.ok) {
      const data = (await response.json()) as { tools: unknown[] };
      checks.push({ name: "tools", status: "healthy", detail: `${data.tools.length} registered` });
    } else {
      checks.push({ name: "tools", status: "degraded" });
    }
  } catch {
    checks.push({ name: "tools", status: "unreachable" });
  }

  const overall = checks.every((c) => c.status === "healthy")
    ? "healthy"
    : checks.some((c) => c.status === "unhealthy" || c.status === "unreachable")
    ? "unhealthy"
    : "degraded";

  if (options.format === "json") {
    formatOutput({ overall, checks }, { format: "json", colorize: true });
  } else {
    const color = overall === "healthy" ? chalk.green : overall === "degraded" ? chalk.yellow : chalk.red;
    console.log(`Overall: ${color(overall)}`);
    console.log("");
    for (const check of checks) {
      const checkColor = check.status === "healthy" ? chalk.green : check.status === "degraded" ? chalk.yellow : chalk.red;
      const detail = check.detail ? ` (${check.detail})` : "";
      const latency = check.latency ? ` ${check.latency}ms` : "";
      console.log(`  ${check.name}: ${checkColor(check.status)}${detail}${latency}`);
    }
  }
}

async function handleUsage(options: UsageOptions): Promise<void> {
  const baseUrl = await getBaseUrl();
  const period = options.period ?? "month";

  try {
    const response = await fetch(`${baseUrl}/llm-config/usage?period=${period}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch usage data (${response.status})`);
    }
    const data = (await response.json()) as {
      totalTokens: number;
      totalRequests: number;
      dailySpendUsd: number;
      monthlySpendUsd: number;
      byModel: Array<Record<string, unknown>>;
    };

    console.log(chalk.blue(`Usage for: ${period}`));
    console.log(`  Total tokens: ${data.totalTokens.toLocaleString()}`);
    console.log(`  Total requests: ${data.totalRequests.toLocaleString()}`);
    console.log(`  Daily spend: $${data.dailySpendUsd.toFixed(4)}`);
    console.log(`  Monthly spend: $${data.monthlySpendUsd.toFixed(4)}`);

    if (data.byModel.length > 0) {
      console.log("");
      const rows = data.byModel.map((entry) => ({
        model: String(entry.modelId ?? ""),
        tokens: Number(entry.totalTokens ?? 0).toLocaleString(),
        requests: Number(entry.requestCount ?? 0).toLocaleString(),
        cost: `$${Number(entry.estimatedCostUsd ?? 0).toFixed(4)}`,
      }));
      formatOutput(rows, { format: options.format ?? "table", colorize: true });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
}

async function handleConnections(options: ConnectionsOptions): Promise<void> {
  const baseUrl = await getBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/heartbeat/connections`);
    if (!response.ok) {
      throw new Error(`Failed to fetch connections (${response.status})`);
    }
    const data = (await response.json()) as {
      active: number;
      total: number;
      connections: Array<Record<string, unknown>>;
    };

    console.log(chalk.blue(`Active connections: ${data.active}/${data.total}`));
    if (data.connections.length > 0) {
      const rows = data.connections.map((conn) => ({
        id: String(conn.id ?? "").slice(0, 8),
        type: String(conn.type ?? ""),
        remoteAddress: String(conn.remoteAddress ?? ""),
        state: String(conn.state ?? ""),
        uptime: String(conn.uptime ?? ""),
      }));
      formatOutput(rows, { format: options.format ?? "table", colorize: true });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
}

export function registerStatusCommand(program: Command): void {
  const status = program
    .command("status")
    .description("Show system status and overview");

  status
    .option("-f, --format <format>", "output format: json, text")
    .option("-v, --verbose", "show detailed information")
    .action(async (options: StatusOptions) => {
      await handleStatus(options);
    });

  status
    .command("health")
    .description("Check system health")
    .option("-f, --format <format>", "output format: json, text")
    .option("--timeout <ms>", "health check timeout in milliseconds")
    .action(async (options: HealthOptions) => {
      await handleHealth(options);
    });

  status
    .command("usage")
    .description("Show resource usage statistics")
    .option("-p, --period <period>", "time period: day, week, month")
    .option("-f, --format <format>", "output format: json, table")
    .action(async (options: UsageOptions) => {
      await handleUsage(options);
    });

  status
    .command("connections")
    .description("Show active connections")
    .option("-f, --format <format>", "output format: json, table")
    .action(async (options: ConnectionsOptions) => {
      await handleConnections(options);
    });
}
