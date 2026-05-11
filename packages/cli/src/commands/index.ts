import type { Command } from "commander";
import { registerChatCommand } from "./chat.js";
import { registerConfigCommand } from "./config.js";
import { registerModelCommand } from "./model.js";
import { registerWorldCommand } from "./world.js";
import { registerStrategyCommand } from "./strategy.js";
import { registerToolCommand } from "./tool.js";
import { registerServeCommand } from "./serve.js";
import { registerStatusCommand } from "./status.js";
import { registerDoctorCommand } from "./doctor.js";

export function registerCommands(program: Command): void {
  registerChatCommand(program);
  registerConfigCommand(program);
  registerModelCommand(program);
  registerWorldCommand(program);
  registerStrategyCommand(program);
  registerToolCommand(program);
  registerServeCommand(program);
  registerStatusCommand(program);
  registerDoctorCommand(program);
}
