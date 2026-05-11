import type { Command } from 'commander';
import chalk from 'chalk';
import { output } from '../utils/output';

export function registerToolCommand(program: Command): void {
  const tool = program
    .command('tool')
    .description('Manage tools and plugins');

  tool
    .command('list')
    .description('List available tools')
    .option('--builtin', 'Show only built-in tools')
    .option('--plugins', 'Show only plugins')
    .action(async (options) => {
      try {
        const res = await fetch('http://localhost:7529/api/v1/tools');
        if (!res.ok) {
          output.error(`API error: ${res.status}`);
          process.exit(1);
        }

        const data = await res.json();
        let tools: Array<{ name: string; type: string; description?: string }> = (data as any).data ?? data ?? [];

        if (options.builtin) {
          tools = tools.filter((t) => t.type === 'builtin');
        } else if (options.plugins) {
          tools = tools.filter((t) => t.type === 'plugin');
        }

        if (tools.length === 0) {
          output.info('No tools found');
          return;
        }

        output.print(chalk.bold('Tools:'));
        tools.forEach((t) => {
          const typeLabel = t.type === 'builtin' ? chalk.green('[builtin]') : chalk.cyan('[plugin]');
          output.print(`  ${typeLabel} ${chalk.bold(t.name)}${t.description ? ` - ${t.description}` : ''}`);
        });
      } catch (err) {
        output.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  tool
    .command('run <name> [args...]')
    .description('Execute a tool')
    .action(async (name, args) => {
      try {
        output.info(`Running tool: ${name}...`);
        const res = await fetch('http://localhost:7529/api/v1/tools/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: name, args }),
        });

        if (!res.ok) {
          output.error(`API error: ${res.status}`);
          process.exit(1);
        }

        const data = await res.json();
        output.success('Tool execution complete:');
        output.print(JSON.stringify(data, null, 2));
      } catch (err) {
        output.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  tool
    .command('install <source>')
    .description('Install a plugin')
    .action(async (source) => {
      try {
        output.info(`Installing plugin from ${source}...`);
        const res = await fetch('http://localhost:7529/api/v1/tools/install', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source }),
        });

        if (!res.ok) {
          output.error(`API error: ${res.status}`);
          process.exit(1);
        }

        output.success('Plugin installed successfully');
      } catch (err) {
        output.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
