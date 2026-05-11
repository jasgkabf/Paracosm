import type { Command } from 'commander';
import chalk from 'chalk';
import { output } from '../utils/output';

export function registerStrategyCommand(program: Command): void {
  const strategy = program
    .command('strategy')
    .description('Manage evolution strategies');

  strategy
    .command('list')
    .description('List all strategies')
    .action(async () => {
      try {
        const res = await fetch('http://localhost:7529/api/v1/strategy');
        if (!res.ok) {
          output.error(`API error: ${res.status}`);
          process.exit(1);
        }

        const data = await res.json();
        const strategies: Array<{ id: string; name: string; fitness: number; generation: number; status: string }> = data.data ?? data ?? [];

        if (strategies.length === 0) {
          output.info('No strategies found');
          return;
        }

        output.print(chalk.bold('Strategies:'));
        strategies.forEach((s) => {
          const fitness = (s.fitness * 100).toFixed(1);
          const statusColor = s.status === 'active' ? chalk.green : s.status === 'evolving' ? chalk.cyan : chalk.gray;
          output.print(`  ${chalk.bold(s.name)} gen=${s.generation} fitness=${chalk.green(fitness + '%')} ${statusColor(s.status)}`);
        });
      } catch (err) {
        output.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  strategy
    .command('evolve')
    .description('Run strategy evolution cycle')
    .option('-g, --generations <n>', 'Number of generations', '1')
    .action(async (options) => {
      try {
        output.info(`Running ${options.generations} evolution cycle(s)...`);
        const res = await fetch('http://localhost:7529/api/v1/strategy/evolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ generations: parseInt(options.generations, 10) }),
        });

        if (!res.ok) {
          output.error(`API error: ${res.status}`);
          process.exit(1);
        }

        const data = await res.json();
        output.success('Evolution complete');
        output.print(JSON.stringify(data, null, 2));
      } catch (err) {
        output.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  strategy
    .command('show <id>')
    .description('Show strategy details')
    .action(async (id) => {
      try {
        const res = await fetch(`http://localhost:7529/api/v1/strategy/${id}`);
        if (!res.ok) {
          output.error(`API error: ${res.status}`);
          process.exit(1);
        }

        const data = await res.json();
        output.print(JSON.stringify(data, null, 2));
      } catch (err) {
        output.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
