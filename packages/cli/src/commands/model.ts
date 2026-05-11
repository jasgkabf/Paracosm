import type { Command } from 'commander';
import chalk from 'chalk';
import { output } from '../utils/output';

export function registerModelCommand(program: Command): void {
  const model = program
    .command('model')
    .description('Manage LLM models and providers');

  model
    .command('list')
    .description('List available models')
    .option('-p, --provider <provider>', 'Filter by provider')
    .action(async (options) => {
      try {
        const res = await fetch('http://localhost:7529/api/v1/llm-config');
        if (!res.ok) {
          output.error(`API error: ${res.status}`);
          process.exit(1);
        }

        const data = await res.json();
        const providers: Array<{ provider: string; models: string[] }> = data.providers ?? [];

        output.print(chalk.bold('Available Models:'));

        for (const p of providers) {
          if (options.provider && p.provider !== options.provider) continue;
          output.print(`  ${chalk.cyan(p.provider)}`);
          for (const m of p.models) {
            output.print(`    - ${m}`);
          }
        }
      } catch (err) {
        output.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  model
    .command('set <model>')
    .description('Set the default model')
    .action(async (modelName) => {
      try {
        const res = await fetch('http://localhost:7529/api/v1/llm-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ defaultModel: modelName }),
        });

        if (!res.ok) {
          output.error(`API error: ${res.status}`);
          process.exit(1);
        }

        output.success(`Default model set to ${chalk.cyan(modelName)}`);
      } catch (err) {
        output.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  model
    .command('test [model]')
    .description('Test a model with a simple prompt')
    .action(async (modelName) => {
      try {
        output.info(`Testing model: ${modelName ?? 'default'}...`);
        const res = await fetch('http://localhost:7529/api/v1/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'Hello, respond with "OK" if you can hear me.',
            model: modelName,
            stream: false,
          }),
        });

        if (!res.ok) {
          output.error(`API error: ${res.status}`);
          process.exit(1);
        }

        const data = await res.json();
        output.success('Model responded:');
        output.print(data.message ?? data.content ?? 'No response');
      } catch (err) {
        output.error(`Test failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
