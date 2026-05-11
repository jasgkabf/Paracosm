import type { Command } from 'commander';
import chalk from 'chalk';
import { render } from 'ink';
import React from 'react';
import { InteractiveChat } from '../ui/interactive-chat';
import { output } from '../utils/output';

export function registerChatCommand(program: Command): void {
  const chat = program
    .command('chat')
    .description('Start an interactive chat session')
    .option('-p, --persona <persona>', 'Select a persona', 'default')
    .option('-m, --model <model>', 'Specify model to use')
    .option('-s, --stream', 'Enable streaming responses', true)
    .option('--no-stream', 'Disable streaming responses')
    .option('-t, --temperature <temp>', 'Set temperature', '0.7')
    .option('--max-tokens <tokens>', 'Max tokens for response', '4096')
    .action(async (options) => {
      try {
        render(React.createElement(InteractiveChat, {
          persona: options.persona,
          model: options.model,
          stream: options.stream,
          temperature: parseFloat(options.temperature),
          maxTokens: parseInt(options.maxTokens, 10),
        }));
      } catch (err) {
        output.error(`Chat failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  chat
    .command('send <message>')
    .description('Send a single message and exit')
    .option('-p, --persona <persona>', 'Select a persona', 'default')
    .action(async (message, options) => {
      try {
        output.info(`Sending to ${options.persona}...`);
        const res = await fetch(`http://localhost:7529/api/v1/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            personas: [options.persona],
            stream: false,
          }),
        });

        if (!res.ok) {
          output.error(`API error: ${res.status}`);
          process.exit(1);
        }

        const data = await res.json();
        output.print(chalk.green((data as any).message ?? (data as any).content ?? 'No response'));
      } catch (err) {
        output.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
