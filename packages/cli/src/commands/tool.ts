import { Command } from "commander";
import chalk from "chalk";
import { DEFAULT_PORT } from "@paracosm/shared";
import { formatOutput } from "../utils/output.js";
import { resolveConfig } from "../utils/config-resolver.js";

interface ToolListOptions {
  type?: string;
  enabled?: boolean;
  format?: "json" | "table";
}

interface ToolInstallOptions {
  force?: boolean;
  version?: string;
}

interface ToolUninstallOptions {
  force?: boolean;
  purge?: boolean;
}

interface McpAddOptions {
  transport?: "stdio" | "sse" | "websocket" | "http";
  command?: string;
  args?: string;
  url?: string;
  headers?: string;
  env?: string;
  enabled?: boolean;
}

interface McpRemoveOptions {
  force?: boolean;
  cleanup?: boolean;
}

async function getBaseUrl(): Promise<string> {
  const config = await resolveConfig();
  return `http://localhost:${config.port || DEFAULT_PORT}/api/v1`;
}

async function handleToolList(options: ToolListOptions): Promise<void> {
  const baseUrl = await getBaseUrl();
  const params = new URLSearchParams();
  if (options.type) params.set("type", options.type);
  if (options.enabled !== undefined) params.set("enabled", String(options.enabled));

  try {
    const response = await fetch(`${baseUrl}/tools?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch tools (${response.status})`);
    }
    const data = (await response.json()) as {
      tools: Array<Record<string, unknown>>;
    };

    console.log(chalk.blue(`Tools (${data.tools.length} registered)`));
    const rows = data.tools.map((tool) => ({
      id: String(tool.id ?? "").slice(0, 8),
      name: String(tool.name ?? ""),
      type: String(tool.type ?? ""),
      version: String(tool.version ?? ""),
      enabled: tool.enabled !== false ? "yes" : "no",
      deprecated: tool.deprecated ? "yes" : "no",
    }));

    formatOutput(rows, { format: options.format ?? "table", colorize: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
}

async function handleToolInstall(
  toolName: string,
  options: ToolInstallOptions
): Promise<void> {
  const baseUrl = await getBaseUrl();

  try {
    const body: Record<string, unknown> = { name: toolName };
    if (options.version) body.version = options.version;
    if (options.force) body.force = true;

    const response = await fetch(`${baseUrl}/tools/install`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to install tool (${response.status}): ${errorBody}`);
    }

    const result = (await response.json()) as { id: string; name: string; version: string };
    console.log(chalk.green(`Tool installed: ${result.name} v${result.version} (${result.id})`));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
}

async function handleToolUninstall(
  toolId: string,
  options: ToolUninstallOptions
): Promise<void> {
  const baseUrl = await getBaseUrl();

  try {
    const params = new URLSearchParams();
    if (options.force) params.set("force", "true");
    if (options.purge) params.set("purge", "true");

    const response = await fetch(`${baseUrl}/tools/${toolId}?${params.toString()}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(`Failed to uninstall tool (${response.status})`);
    }

    console.log(chalk.green(`Tool uninstalled: ${toolId}`));
    if (options.purge) {
      console.log(chalk.gray("  Configuration and data purged"));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
}

async function handleMcpAdd(
  serverName: string,
  options: McpAddOptions
): Promise<void> {
  const baseUrl = await getBaseUrl();
  const transport = options.transport ?? "stdio";

  const transportConfig: Record<string, unknown> = {
    type: transport,
    command: options.command ?? null,
    args: options.args ? options.args.split(",") : [],
    url: options.url ?? null,
    headers: options.headers ? JSON.parse(options.headers) : {},
    env: options.env ? JSON.parse(options.env) : {},
    restartOnFailure: true,
    maxRestartAttempts: 3,
    restartDelayMs: 5000,
  };

  const serverConfig: Record<string, unknown> = {
    name: serverName,
    transport: transportConfig,
    enabled: options.enabled !== false,
  };

  try {
    const response = await fetch(`${baseUrl}/tools/mcp/servers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serverConfig),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to add MCP server (${response.status}): ${errorBody}`);
    }

    const result = (await response.json()) as { id: string; name: string };
    console.log(chalk.green(`MCP server added: ${result.name} (${result.id})`));
    console.log(chalk.gray(`  Transport: ${transport}`));
    if (transport === "stdio" && options.command) {
      console.log(chalk.gray(`  Command: ${options.command}`));
    }
    if (transport !== "stdio" && options.url) {
      console.log(chalk.gray(`  URL: ${options.url}`));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
}

async function handleMcpRemove(
  serverId: string,
  options: McpRemoveOptions
): Promise<void> {
  const baseUrl = await getBaseUrl();

  try {
    const params = new URLSearchParams();
    if (options.force) params.set("force", "true");
    if (options.cleanup) params.set("cleanup", "true");

    const response = await fetch(`${baseUrl}/tools/mcp/servers/${serverId}?${params.toString()}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(`Failed to remove MCP server (${response.status})`);
    }

    console.log(chalk.green(`MCP server removed: ${serverId}`));
    if (options.cleanup) {
      console.log(chalk.gray("  Connections and resources cleaned up"));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
}

export function registerToolCommand(program: Command): void {
  const tool = program
    .command("tool")
    .description("Manage tools and MCP servers");

  tool
    .command("list")
    .description("List registered tools")
    .option("-t, --type <type>", "filter by tool type")
    .option("--enabled", "show only enabled tools")
    .option("-f, --format <format>", "output format: json, table")
    .action(async (options: ToolListOptions) => {
      await handleToolList(options);
    });

  tool
    .command("install")
    .description("Install a tool")
    .argument("<name>", "tool name or package")
    .option("--force", "force installation even if already installed")
    .option("--version <version>", "specific version to install")
    .action(async (name: string, options: ToolInstallOptions) => {
      await handleToolInstall(name, options);
    });

  tool
    .command("uninstall")
    .description("Uninstall a tool")
    .argument("<id>", "tool identifier")
    .option("--force", "force uninstallation")
    .option("--purge", "remove all configuration and data")
    .action(async (id: string, options: ToolUninstallOptions) => {
      await handleToolUninstall(id, options);
    });

  const mcp = tool
    .command("mcp")
    .description("Manage MCP (Model Context Protocol) servers");

  mcp
    .command("add")
    .description("Add an MCP server")
    .argument("<name>", "server name")
    .option("--transport <type>", "transport type: stdio, sse, websocket, http")
    .option("--command <cmd>", "command to run (for stdio transport)")
    .option("--args <args>", "comma-separated arguments")
    .option("--url <url>", "server URL (for sse/websocket/http transport)")
    .option("--headers <json>", "HTTP headers as JSON")
    .option("--env <json>", "environment variables as JSON")
    .option("--enabled", "enable the server immediately", true)
    .action(async (name: string, options: McpAddOptions) => {
      await handleMcpAdd(name, options);
    });

  mcp
    .command("remove")
    .description("Remove an MCP server")
    .argument("<id>", "server identifier")
    .option("--force", "force removal")
    .option("--cleanup", "clean up connections and resources")
    .action(async (id: string, options: McpRemoveOptions) => {
      await handleMcpRemove(id, options);
    });
}
