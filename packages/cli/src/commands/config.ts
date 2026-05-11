import type { Command } from 'commander';
import chalk from 'chalk';
import { render } from 'ink';
import React from 'react';
import { ConfigWizard } from '../ui/config-wizard';
import { output } from '../utils/output';
import { resolveConfig } from '../utils/config-resolver';

export function registerConfigCommand(program: Command): void {
  const config = program
    .command('config')
    .description('Manage Paracosm configuration');

  config
    .command('init')
    .description('Initialize configuration with interactive wizard')
    .action(async () => {
      try {
        render(React.createElement(ConfigWizard));
      } catch (err) {
        output.error(`Config init failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  config
    .command('show')
    .description('Display current configuration')
    .action(async () => {
      try {
        const cfg = await resolveConfig();
        output.print(chalk.bold('Current Configuration:'));
        output.print(JSON.stringify(cfg, null, 2));
      } catch (err) {
        output.error(`Failed to load config: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  config
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action(async (key, value) => {
      try {
        output.info(`Setting ${key} = ${value}`);
        const res = await fetch('http://localhost:7529/api/v1/llm-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: value }),
        });

        if (!res.ok) {
          output.error(`API error: ${res.status}`);
          process.exit(1);
        }

        output.success(`${key} updated successfully`);
      } catch (err) {
        output.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  config
    .command('path')
    .description('Show configuration file path')
    .action(() => {
      const configPath = process.env.PARACOSM_CONFIG ?? `${process.env.HOME ?? '~'}/.paracosm/config.json`;
      output.print(configPath);
    });
}
