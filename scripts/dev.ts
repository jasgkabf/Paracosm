import { execSync } from "node:child_process";

function run(cmd: string): void {
  execSync(cmd, { stdio: "inherit", env: { ...process.env } });
}

function dev(): void {
  console.info("[paracosm] Starting development server...");

  process.env.NODE_ENV = process.env.NODE_ENV ?? "development";
  process.env.PORT = process.env.PORT ?? "7529";

  run("turbo run dev");

  console.info("[paracosm] Development server stopped.");
}

dev();
