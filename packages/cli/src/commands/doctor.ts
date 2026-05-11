import { Command } from "commander";
import chalk from "chalk";
import { DEFAULT_PORT, APP_NAME, APP_VERSION } from "@paracosm/shared";
import { resolveConfig } from "../utils/config-resolver.js";
import { isRunning, getDaemonPid } from "../utils/process-manager.js";

interface DiagnoseOptions {
  fix?: boolean;
  verbose?: boolean;
}

interface FixOptions {
  dryRun?: boolean;
  all?: boolean;
}

interface CheckOptions {
  timeout?: string;
  verbose?: boolean;
}

interface ConnectivityOptions {
  timeout?: string;
  format?: "json" | "text";
}

interface PermissionsOptions {
  fix?: boolean;
  verbose?: boolean;
}

interface DiagnosticResult {
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
  fix?: string;
}

async function getBaseUrl(): Promise<string> {
  const config = await resolveConfig();
  return `http://localhost:${config.port || DEFAULT_PORT}/api/v1`;
}

async function checkServerReachable(timeout: number): Promise<DiagnosticResult> {
  const baseUrl = await getBaseUrl();
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(`${baseUrl}/heartbeat`, { signal: controller.signal });
    clearTimeout(timer);
    const latency = Date.now() - start;

    if (response.ok) {
      return { name: "Server", status: "pass", message: `Reachable (${latency}ms)` };
    }
    return { name: "Server", status: "fail", message: `HTTP ${response.status}`, fix: "Check server logs for errors" };
  } catch {
    return { name: "Server", status: "fail", message: "Unreachable", fix: "Run 'paracosm serve start' to start the server" };
  }
}

async function checkConfigFile(): Promise<DiagnosticResult> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const os = await import("node:os");

  const configPaths = [
    path.join(process.cwd(), ".paracosm.json"),
    path.join(os.homedir(), ".paracosm", "config.json"),
  ];

  for (const configPath of configPaths) {
    try {
      await fs.access(configPath);
      const content = await fs.readFile(configPath, "utf-8");
      JSON.parse(content);
      return { name: "Config", status: "pass", message: `Found at ${configPath}` };
    } catch {
      continue;
    }
  }

  return {
    name: "Config",
    status: "warn",
    message: "No configuration file found",
    fix: "Run 'paracosm config init' to create a configuration file",
  };
}

async function checkProviders(): Promise<DiagnosticResult> {
  const config = await resolveConfig();
  const providers = config.providers as Record<string, Record<string, unknown>> | undefined;

  if (!providers || Object.keys(providers).length === 0) {
    return {
      name: "Providers",
      status: "fail",
      message: "No providers configured",
      fix: "Run 'paracosm config set providers.openai.apiKey <key>' to add a provider",
    };
  }

  const enabledProviders = Object.entries(providers).filter(([, p]) => p.enabled);
  const providersWithKeys = enabledProviders.filter(([, p]) => p.apiKey || p.baseUrl?.includes("localhost"));

  if (providersWithKeys.length === 0) {
    return {
      name: "Providers",
      status: "warn",
      message: `${enabledProviders.length} enabled but no API keys configured`,
      fix: "Add API keys using 'paracosm config set providers.<name>.apiKey <key>'",
    };
  }

  return { name: "Providers", status: "pass", message: `${providersWithKeys.length} provider(s) configured` };
}

async function checkNodeVersion(): Promise<DiagnosticResult> {
  const version = process.version;
  const major = parseInt(version.slice(1).split(".")[0], 10);

  if (major >= 20) {
    return { name: "Node.js", status: "pass", message: `v${version.slice(1)}` };
  }
  return {
    name: "Node.js",
    status: "fail",
    message: `v${version.slice(1)} (requires >= 20.0.0)`,
    fix: "Upgrade Node.js to version 20 or later",
  };
}

async function checkPortAvailable(): Promise<DiagnosticResult> {
  const net = await import("node:net");
  const config = await resolveConfig();
  const port = config.port || DEFAULT_PORT;

  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        if (isRunning()) {
          resolve({ name: "Port", status: "pass", message: `${port} in use by Paracosm` });
        } else {
          resolve({
            name: "Port",
            status: "warn",
            message: `${port} in use by another process`,
            fix: `Change port with 'paracosm serve port <number>' or stop the other process`,
          });
        }
      } else {
        resolve({ name: "Port", status: "fail", message: `Error checking port: ${err.message}` });
      }
    });
    server.once("listening", () => {
      server.close();
      resolve({ name: "Port", status: "pass", message: `${port} available` });
    });
    server.listen(port);
  });
}

async function runDiagnostics(verbose: boolean): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  results.push(await checkNodeVersion());
  results.push(await checkConfigFile());
  results.push(await checkProviders());
  results.push(await checkPortAvailable());
  results.push(await checkServerReachable(5000));

  if (verbose) {
    results.push({
      name: "Version",
      status: "pass",
      message: `${APP_NAME} v${APP_VERSION}`,
    });
  }

  return results;
}

async function handleDiagnose(options: DiagnoseOptions): Promise<void> {
  console.log(chalk.blue("Running diagnostics..."));
  console.log("");

  const results = await runDiagnostics(options.verbose ?? false);

  for (const result of results) {
    const icon = result.status === "pass" ? chalk.green("[PASS]") : result.status === "warn" ? chalk.yellow("[WARN]") : chalk.red("[FAIL]");
    console.log(`  ${icon} ${result.name}: ${result.message}`);
    if (result.fix && (result.status !== "pass")) {
      console.log(chalk.gray(`         Fix: ${result.fix}`));
    }
  }

  const failures = results.filter((r) => r.status === "fail");
  const warnings = results.filter((r) => r.status === "warn");

  console.log("");
  if (failures.length === 0 && warnings.length === 0) {
    console.log(chalk.green("All diagnostics passed."));
  } else {
    if (failures.length > 0) {
      console.log(chalk.red(`${failures.length} failure(s) detected.`));
    }
    if (warnings.length > 0) {
      console.log(chalk.yellow(`${warnings.length} warning(s) detected.`));
    }
    if (options.fix) {
      console.log("");
      console.log(chalk.blue("Attempting fixes..."));
      for (const failure of failures) {
        if (failure.fix) {
          console.log(chalk.gray(`  ${failure.name}: ${failure.fix}`));
        }
      }
    }
  }
}

async function handleFix(options: FixOptions): Promise<void> {
  console.log(chalk.blue("Running diagnostics with auto-fix..."));
  console.log("");

  const results = await runDiagnostics(false);
  const fixable = results.filter((r) => r.status !== "pass" && r.fix);

  if (fixable.length === 0) {
    console.log(chalk.green("No issues to fix."));
    return;
  }

  for (const issue of fixable) {
    console.log(chalk.yellow(`  ${issue.name}: ${issue.message}`));
    console.log(chalk.gray(`    Suggested fix: ${issue.fix}`));

    if (options.dryRun) {
      console.log(chalk.blue("    [dry-run] Would attempt fix"));
      continue;
    }

    if (issue.name === "Config") {
      const { execSync } = await import("node:child_process");
      try {
        execSync("paracosm config init", { stdio: "inherit" });
        console.log(chalk.green("    Fixed: Configuration initialized"));
      } catch {
        console.log(chalk.red("    Failed: Could not initialize config"));
      }
    }
  }
}

async function handleCheck(options: CheckOptions): Promise<void> {
  const timeout = options.timeout ? parseInt(options.timeout, 10) : 5000;
  const result = await checkServerReachable(timeout);

  if (result.status === "pass") {
    console.log(chalk.green(`Server is reachable: ${result.message}`));
  } else {
    console.log(chalk.red(`Server check failed: ${result.message}`));
    if (result.fix) {
      console.log(chalk.gray(`  Suggested: ${result.fix}`));
    }
    process.exit(1);
  }
}

async function handleConnectivity(options: ConnectivityOptions): Promise<void> {
  const timeout = options.timeout ? parseInt(options.timeout, 10) : 5000;
  const baseUrl = await getBaseUrl();

  const endpoints = [
    { name: "Heartbeat", path: "/heartbeat" },
    { name: "Chat", path: "/chat" },
    { name: "World Model", path: "/world-model" },
    { name: "Tools", path: "/tools" },
    { name: "Strategy", path: "/strategy" },
  ];

  const results: Array<{ endpoint: string; status: string; latency: string }> = [];

  for (const endpoint of endpoints) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(`${baseUrl}${endpoint.path}`, { signal: controller.signal });
      clearTimeout(timer);
      const latency = Date.now() - start;
      results.push({
        endpoint: endpoint.name,
        status: response.ok ? "ok" : `HTTP ${response.status}`,
        latency: `${latency}ms`,
      });
    } catch {
      results.push({
        endpoint: endpoint.name,
        status: "unreachable",
        latency: "N/A",
      });
    }
  }

  if (options.format === "json") {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const result of results) {
      const color = result.status === "ok" ? chalk.green : chalk.red;
      console.log(`  ${result.endpoint}: ${color(result.status)} (${result.latency})`);
    }
  }
}

async function handlePermissions(options: PermissionsOptions): Promise<void> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const os = await import("node:os");

  const checks: Array<{ path: string; readable: boolean; writable: boolean }> = [];

  const configDir = path.join(os.homedir(), ".paracosm");
  const configFile = path.join(configDir, "config.json");
  const pidDir = path.join(os.homedir(), ".paracosm");

  for (const checkPath of [configDir, configFile, pidDir]) {
    const readable = await fs.access(checkPath, fs.constants.R_OK).then(() => true).catch(() => false);
    const writable = await fs.access(checkPath, fs.constants.W_OK).then(() => true).catch(() => false);
    checks.push({ path: checkPath, readable, writable });
  }

  console.log(chalk.blue("Permission check:"));
  for (const check of checks) {
    const r = check.readable ? chalk.green("R") : chalk.red("R");
    const w = check.writable ? chalk.green("W") : chalk.red("W");
    console.log(`  ${r}${w} ${check.path}`);
  }

  const issues = checks.filter((c) => !c.readable || !c.writable);
  if (issues.length > 0) {
    console.log("");
    console.log(chalk.yellow(`${issues.length} permission issue(s) found.`));
    if (options.fix) {
      for (const issue of issues) {
        try {
          await fs.mkdir(path.dirname(issue.path), { recursive: true });
          console.log(chalk.green(`  Created: ${path.dirname(issue.path)}`));
        } catch {
          console.log(chalk.red(`  Failed to create: ${issue.path}`));
        }
      }
    }
  }
}

export function registerDoctorCommand(program: Command): void {
  const doctor = program
    .command("doctor")
    .description("Diagnose and fix Paracosm issues");

  doctor
    .option("--fix", "attempt to fix issues automatically")
    .option("-v, --verbose", "show additional diagnostic details")
    .action(async (options: DiagnoseOptions) => {
      await handleDiagnose(options);
    });

  doctor
    .command("fix")
    .description("Automatically fix detected issues")
    .option("--dry-run", "preview fixes without applying")
    .option("--all", "fix all issues including warnings")
    .action(async (options: FixOptions) => {
      await handleFix(options);
    });

  doctor
    .command("check")
    .description("Quick server connectivity check")
    .option("--timeout <ms>", "timeout in milliseconds")
    .option("-v, --verbose", "show detailed information")
    .action(async (options: CheckOptions) => {
      await handleCheck(options);
    });

  doctor
    .command("connectivity")
    .description("Test connectivity to all API endpoints")
    .option("--timeout <ms>", "timeout in milliseconds")
    .option("-f, --format <format>", "output format: json, text")
    .action(async (options: ConnectivityOptions) => {
      await handleConnectivity(options);
    });

  doctor
    .command("permissions")
    .description("Check file and directory permissions")
    .option("--fix", "attempt to fix permission issues")
    .option("-v, --verbose", "show detailed information")
    .action(async (options: PermissionsOptions) => {
      await handlePermissions(options);
    });
}
