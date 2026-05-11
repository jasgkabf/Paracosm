import chalk from "chalk";
import { APP_NAME } from "@paracosm/shared";

const LOGO_LINES = [
  "  ____                      _            ",
  " |  _ \\ __ _ ___  ___ _ __ | | __ _ _   ",
  " | |_) / _` / __|/ _ \\ '_ \\| |/ _` | |  ",
  " |  __/ (_| \\__ \\  __/ |_) | | (_| | |  ",
  " |_|   \\__,_|___/\\___| .__/|_|\\__,_|_|  ",
  "                     |_|                  ",
];

const BANNER_LINES = [
  "========================================",
  `  ${APP_NAME} - AI Agent Framework`,
  "========================================",
];

export function renderAsciiLogo(): string {
  return LOGO_LINES.map((line) => chalk.cyan(line)).join("\n");
}

export function renderBanner(): string {
  return BANNER_LINES.map((line) => chalk.cyan(line)).join("\n");
}

export function renderDivider(label?: string, width: number = 50): string {
  if (label) {
    const labelLen = label.length + 2;
    const sideLen = Math.max(0, Math.floor((width - labelLen) / 2));
    const left = "-".repeat(sideLen);
    const right = "-".repeat(Math.max(0, width - labelLen - sideLen));
    return chalk.dim(`${left} ${label} ${right}`);
  }
  return chalk.dim("-".repeat(width));
}
