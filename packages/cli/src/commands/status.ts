import type { Command } from 'commander';
import chalk from 'chalk';
import { render } from 'ink';
import React from 'react';
import { StatusDashboard } from '../ui/status-dashboard';
import { output } from '../utils/output';

export function registerStatusCommand(program: Command): void {
  const status = program
    .command('status')
    .description('Show system status and heartbeat');

  status
    .action(async () => {
      try {
        render(React.createElement(StatusDashboard));
      } catch (err) {
        output.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  status
    .command('heartbeat')
    .description('Show heartbeat monitor')
    .action(async () => {
      try {
        render(React.createElement(StatusDashboard, { heartbeatOnly: true }));
      } catch (err) {
        output.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  status
    .command('providers')
    .description('Show LLM provider status')
    .action(async () => {
      try {
        const res = await fetch('http://localhost:7529/api/v1/heartbeat');
        if (!res.ok) {
          output.error(`API error: ${res.status}`);
          process.exit(1);
        }

        const data = await res.json();
        const providers: Array<{ provider: string; available: boolean; latencyMs: number; errorRate: number }> =
          (data as any).providerStatuses ?? [];

        if (providers.length === 0) {
          output.info('No providers configured');
          return;
        }

        output.print(chalk.bold('Provider Status:'));
        providers.forEach((p) => {
          const status = p.available ? chalk.green('ONLINE') : chalk.red('OFFLINE');
          const latency = `${p.latencyMs.toFixed(0)}ms`;
          const success = `${((1 - p.errorRate) * 100).toFixed(1)}%`;
          output.print(`  ${chalk.cyan(p.provider.padEnd(12))} ${status}  latency=${latency}  success=${success}`);
        });
      } catch (err) {
        output.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
