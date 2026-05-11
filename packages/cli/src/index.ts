#!/usr/bin/env node

import { Command } from "commander";
import { APP_NAME, APP_VERSION, DEFAULT_PORT } from "@paracosm/shared";
import { registerCommands } from "./commands/index.js";
import { resolveConfig } from "./utils/config-resolver.js";
import { formatOutput } from "./utils/output.js";
import { renderAsciiLogo } from "./ui/ascii-art.js";

const program = new Command();

program
  .name("paracosm")
  .description(`${APP_NAME} - AI Agent CLI`)
  .version(APP_VERSION)
  .option("-c, --config <path>", "path to config file")
  .option("-p, --port <number>", "server port", String(DEFAULT_PORT))
  .option("--json", "output in JSON format")
  .option("--no-color", "disable colored output")
  .hook("preAction", async (thisCommand) => {
    const opts = thisCommand.opts();
    const configPath = opts.config as string | undefined;
    const resolved = await resolveConfig(configPath);
    thisCommand.setOptionValueWithSource("resolvedConfig", resolved, "default");
  });

registerCommands(program);

program.on("--help", () => {
  console.log("");
  console.log(renderAsciiLogo());
  console.log("");
  console.log("  For more information, visit: https://github.com/paracosm/agent");
});

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  formatOutput({ error: message }, { format: "json", colorize: true });
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  formatOutput({ error: error.message }, { format: "json", colorize: true });
  process.exit(1);
});

program.parseAsync(process.argv).catch((error: Error) => {
  formatOutput({ error: error.message }, { format: "json", colorize: true });
  process.exit(1);
});
