import { Command } from "commander";
import chalk from "chalk";
import { DEFAULT_PORT } from "@paracosm/shared";
import { formatOutput } from "../utils/output.js";
import { resolveConfig } from "../utils/config-resolver.js";
import {
  startDaemon,
  stopDaemon,
  isRunning,
  getDaemonPid,
} from "../utils/process-manager.js";

interface ServeStartOptions {
  port?: string;
  host?: string;
  daemon?: boolean;
}

interface ServeStopOptions {
  force?: boolean;
}

interface ServePortOptions {
  port?: string;
}

interface ServeDaemonOptions {
  port?: string;
  logFile?: string;
  pidFile?: string;
}

interface ServeStatusOptions {
  format?: "json" | "text";
}

async function handleServeStart(options: ServeStartOptions): Promise<void> {
  const config = await resolveConfig();
  const port = options.port ? parseInt(options.port, 10) : config.port || DEFAULT_PORT;
  const host = options.host ?? config.host ?? "0.0.0.0";

  if (await isRunning()) {
    const pid = await getDaemonPid();
    console.log(chalk.yellow(`Server is already running (PID: ${pid})`));
    return;
  }

  if (options.daemon) {
    await startDaemon(port, host);
    console.log(chalk.green(`Server started as daemon on ${host}:${port}`));
    return;
  }

  console.log(chalk.blue(`Starting server on ${host}:${port}`));
  console.log(chalk.gray("Press Ctrl+C to stop"));

  try {
    const serverModule = await import("@paracosm/api");
    if (typeof serverModule.startServer === "function") {
      await serverModule.startServer({ port, host });
    } else {
      const response = await fetch(`http://localhost:${port}/api/v1/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", port, host }),
      }).catch(() => null);

      if (!response || !response.ok) {
        console.log(chalk.gray("Starting server process..."));
        const { spawn } = await import("node:child_process");
        const child = spawn("node", ["dist/server.js"], {
          cwd: process.cwd(),
          env: { ...process.env, PORT: String(port), HOST: host },
          stdio: "inherit",
        });

        child.on("error", (err: Error) => {
          console.error(chalk.red(`Server error: ${err.message}`));
        });

        child.on("exit", (code: number) => {
          console.log(chalk.gray(`Server exited with code ${code}`));
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Failed to start server: ${message}`));
    process.exit(1);
  }
}

async function handleServeStop(options: ServeStopOptions): Promise<void> {
  if (!(await isRunning())) {
    console.log(chalk.yellow("Server is not running"));
    return;
  }

  try {
    await stopDaemon(options.force);
    console.log(chalk.green("Server stopped"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Failed to stop server: ${message}`));
    process.exit(1);
  }
}

async function handleServePort(options: ServePortOptions): Promise<void> {
  const config = await resolveConfig();
  const currentPort = config.port || DEFAULT_PORT;

  if (options.port) {
    const newPort = parseInt(options.port, 10);
    if (newPort < 1 || newPort > 65535) {
      console.error(chalk.red("Port must be between 1 and 65535"));
      process.exit(1);
    }
    config.port = newPort;
    console.log(chalk.green(`Port set to ${newPort}`));
  } else {
    console.log(`Current port: ${currentPort}`);
  }
}

async function handleServeDaemon(options: ServeDaemonOptions): Promise<void> {
  const config = await resolveConfig();
  const port = options.port ? parseInt(options.port, 10) : config.port || DEFAULT_PORT;
  const host = config.host ?? "0.0.0.0";

  if (await isRunning()) {
    const pid = await getDaemonPid();
    console.log(chalk.yellow(`Daemon is already running (PID: ${pid})`));
    return;
  }

  await startDaemon(port, host);
  console.log(chalk.green(`Daemon started on ${host}:${port}`));

  if (options.logFile) {
    console.log(chalk.gray(`Log file: ${options.logFile}`));
  }
}

async function handleServeStatus(options: ServeStatusOptions): Promise<void> {
  const running = await isRunning();
  const pid = running ? await getDaemonPid() : null;
  const config = await resolveConfig();
  const port = config.port || DEFAULT_PORT;
  const host = config.host ?? "0.0.0.0";

  const status = {
    running,
    pid: pid ?? "N/A",
    host,
    port,
    uptime: "N/A",
  };

  if (running) {
    try {
      const response = await fetch(`http://localhost:${port}/api/v1/heartbeat`, {
        method: "GET",
      });
      if (response.ok) {
        const data = (await response.json()) as { uptime?: number; status?: string };
        if (data.uptime) {
          const seconds = Math.floor(data.uptime / 1000);
          const minutes = Math.floor(seconds / 60);
          const hours = Math.floor(minutes / 60);
          status.uptime = hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m ${seconds % 60}s`;
        }
      }
    } catch {
      status.running = false;
    }
  }

  if (options.format === "json") {
    formatOutput(status, { format: "json", colorize: true });
  } else {
    console.log(`Status: ${running ? chalk.green("running") : chalk.red("stopped")}`);
    console.log(`PID: ${status.pid}`);
    console.log(`Host: ${status.host}`);
    console.log(`Port: ${status.port}`);
    console.log(`Uptime: ${status.uptime}`);
  }
}

export function registerServeCommand(program: Command): void {
  const serve = program
    .command("serve")
    .description("Manage the Paracosm server");

  serve
    .command("start")
    .description("Start the Paracosm server")
    .option("-p, --port <number>", "server port")
    .option("-h, --host <host>", "server host")
    .option("-d, --daemon", "run as daemon")
    .action(async (options: ServeStartOptions) => {
      await handleServeStart(options);
    });

  serve
    .command("stop")
    .description("Stop the Paracosm server")
    .option("--force", "force stop the server")
    .action(async (options: ServeStopOptions) => {
      await handleServeStop(options);
    });

  serve
    .command("port")
    .description("Get or set the server port")
    .option("-p, --port <number>", "set a new port")
    .action(async (options: ServePortOptions) => {
      await handleServePort(options);
    });

  serve
    .command("daemon")
    .description("Start the server as a background daemon")
    .option("-p, --port <number>", "server port")
    .option("--log-file <path>", "log file path")
    .option("--pid-file <path>", "PID file path")
    .action(async (options: ServeDaemonOptions) => {
      await handleServeDaemon(options);
    });

  serve
    .command("status")
    .description("Show server status")
    .option("-f, --format <format>", "output format: json, text")
    .action(async (options: ServeStatusOptions) => {
      await handleServeStatus(options);
    });
}
