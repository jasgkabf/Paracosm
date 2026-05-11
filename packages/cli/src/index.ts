#!/usr/bin/env node

import { Command } from 'commander';
import { registerChatCommand } from './commands/chat';
import { registerConfigCommand } from './commands/config';
import { registerModelCommand } from './commands/model';
import { registerWorldCommand } from './commands/world';
import { registerStrategyCommand } from './commands/strategy';
import { registerToolCommand } from './commands/tool';
import { registerServeCommand } from './commands/serve';
import { registerStatusCommand } from './commands/status';
import { registerDoctorCommand } from './commands/doctor';
import { APP_NAME, APP_VERSION } from '@paracosm/shared';

const program = new Command();

program
  .name('paracosm')
  .description('Multi-agent AI orchestration framework CLI')
  .version(APP_VERSION);

registerChatCommand(program);
registerConfigCommand(program);
registerModelCommand(program);
registerWorldCommand(program);
registerStrategyCommand(program);
registerToolCommand(program);
registerServeCommand(program);
registerStatusCommand(program);
registerDoctorCommand(program);

program.parse();
