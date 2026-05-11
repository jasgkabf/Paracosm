import chalk from 'chalk';

const P = chalk.green.bold('P');
const A = chalk.green('a');
const R = chalk.green('r');
const AC = chalk.cyan('a');
const C = chalk.cyan('c');
const O = chalk.cyan('o');
const S = chalk.cyan.bold('s');
const M = chalk.cyan.bold('m');

export const ASCII_LOGO = [
  '',
  `    ${P} ${A} ${R} ${AC} ${C} ${O} ${S} ${M}`,
  '',
  '    Multi-agent AI orchestration framework',
  '',
].join('\n');

export const ASCII_BANNER = [
  '',
  chalk.green.bold('  ____                      _ '),
  chalk.green('  |  _ \\ __ _ ___  ___ __ _| |'),
  chalk.cyan('  | |_) / _` / __|/ __/ _` | |'),
  chalk.cyan('  |  __/ (_| \\__ \\ (_| (_| | |'),
  chalk.green.bold('  |_|   \\__,_|___/\\___\\__,_|_|'),
  '',
  chalk.gray('  v0.1.0 - Multi-agent AI orchestration'),
  '',
].join('\n');

export const SMALL_BANNER = chalk.green.bold('Paracosm') + chalk.gray(' v0.1.0');
