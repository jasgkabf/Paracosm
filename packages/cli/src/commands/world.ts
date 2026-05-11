import type { Command } from 'commander';
import chalk from 'chalk';
import { output } from '../utils/output';

export function registerWorldCommand(program: Command): void {
  const world = program
    .command('world')
    .description('Manage the world model');

  world
    .command('show')
    .description('Display the current world model')
    .option('-f, --format <format>', 'Output format (json, summary)', 'summary')
    .action(async (options) => {
      try {
        const res = await fetch('http://localhost:7529/api/v1/world-model');
        if (!res.ok) {
          output.error(`API error: ${res.status}`);
          process.exit(1);
        }

        const data = await res.json();

        if (options.format === 'json') {
          output.print(JSON.stringify(data, null, 2));
        } else {
          output.print(chalk.bold('World Model Summary:'));
          const entities = (data as any).entities ?? [];
          const relations = (data as any).relations ?? [];
          output.print(`  Entities: ${chalk.cyan(entities.length.toString())}`);
          output.print(`  Relations: ${chalk.cyan(relations.length.toString())}`);
          if (entities.length > 0) {
            output.print(chalk.bold('\n  Top Entities:'));
            entities.slice(0, 10).forEach((e: { name?: string; type?: string }) => {
              output.print(`    - ${chalk.green(e.name ?? 'unknown')} (${e.type ?? 'unknown'})`);
            });
          }
        }
      } catch (err) {
        output.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  world
    .command('entities')
    .description('List world model entities')
    .action(async () => {
      try {
        const res = await fetch('http://localhost:7529/api/v1/world-model');
        if (!res.ok) {
          output.error(`API error: ${res.status}`);
          process.exit(1);
        }

        const data = await res.json();
        const entities: Array<{ id: string; name: string; type: string }> = (data as any).entities ?? [];

        if (entities.length === 0) {
          output.info('No entities found');
          return;
        }

        output.print(chalk.bold('Entities:'));
        entities.forEach((e) => {
          output.print(`  ${chalk.green(e.name)} [${chalk.gray(e.type)}] (${e.id})`);
        });
      } catch (err) {
        output.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  world
    .command('timeline')
    .description('Show world model timeline')
    .action(async () => {
      try {
        const res = await fetch('http://localhost:7529/api/v1/world-model');
        if (!res.ok) {
          output.error(`API error: ${res.status}`);
          process.exit(1);
        }

        const data = await res.json();
        const events: Array<{ name: string; timestamp: string; type: string }> = (data as any).timeline ?? [];

        if (events.length === 0) {
          output.info('No timeline events found');
          return;
        }

        output.print(chalk.bold('Timeline:'));
        events.forEach((e) => {
          output.print(`  ${chalk.gray(e.timestamp)} ${chalk.cyan(e.type)} ${e.name}`);
        });
      } catch (err) {
        output.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
