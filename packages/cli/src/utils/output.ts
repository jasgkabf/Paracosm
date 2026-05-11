import chalk from 'chalk';

export const output = {
  print(msg: string): void {
    console.log(msg);
  },

  info(msg: string): void {
    console.log(chalk.cyan('  info') + ` ${msg}`);
  },

  success(msg: string): void {
    console.log(chalk.green('  done') + ` ${msg}`);
  },

  warn(msg: string): void {
    console.log(chalk.yellow('  warn') + ` ${msg}`);
  },

  error(msg: string): void {
    console.error(chalk.red(' error') + ` ${msg}`);
  },

  debug(msg: string): void {
    if (process.env.DEBUG) {
      console.log(chalk.gray('debug') + ` ${msg}`);
    }
  },

  json(data: unknown): void {
    console.log(JSON.stringify(data, null, 2));
  },

  blank(): void {
    console.log('');
  },
};
