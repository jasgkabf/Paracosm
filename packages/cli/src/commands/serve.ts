import type { Command } from 'commander';
import chalk from 'chalk';
import { output } from '../utils/output';
import { ProcessManager } from '../utils/process-manager';

export function registerServeCommand(program: Command): void {
  program
    .command('serve')
    .description('Start the Paracosm server')
    .option('-p, --port <port>', 'Server port', '7529')
    .option('-h, --host <host>', 'Server host', '0.0.0.0')
    .option('-d, --detach', 'Run server in background')
    .option('--stop', 'Stop the background server')
    .action(async (options) => {
      const pm = new ProcessManager();

      if (options.stop) {
        try {
          await pm.stop();
          output.success('Server stopped');
        } catch (err) {
          output.error(`Failed to stop: ${err instanceof Error ? err.message : String(err)}`);
          process.exit(1);
        }
        return;
      }

      const port = parseInt(options.port, 10);
      const host = options.host;

      if (options.detach) {
        try {
          await pm.start({ port, host });
          output.success(`Server started in background on ${chalk.cyan(`${host}:${port}`)}`);
          output.print(`  PID file: ${pm.pidPath}`);
          output.print(`  Stop with: ${chalk.gray('paracosm serve --stop')}`);
        } catch (err) {
          output.error(`Failed to start: ${err instanceof Error ? err.message : String(err)}`);
          process.exit(1);
        }
        return;
      }

      output.print(chalk.bold(`Starting Paracosm server on ${chalk.cyan(`${host}:${port}`)}`));
      output.print(chalk.gray('Press Ctrl+C to stop'));

      try {
        const { spawn } = await import('child_process');
        const apiPath = require.resolve('@paracosm/api');

        const child = spawn('node', [apiPath], {
          env: { ...process.env, PORT: String(port), HOST: host },
          stdio: 'inherit',
        });

        child.on('error', (err) => {
          output.error(`Server error: ${err.message}`);
          process.exit(1);
        });

        child.on('exit', (code) => {
          if (code !== 0 && code !== null) {
            output.error(`Server exited with code ${code}`);
            process.exit(code);
          }
        });

        process.on('SIGINT', () => {
          child.kill('SIGINT');
          process.exit(0);
        });

        process.on('SIGTERM', () => {
          child.kill('SIGTERM');
          process.exit(0);
        });
      } catch (err) {
        output.error(`Failed to start server: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
