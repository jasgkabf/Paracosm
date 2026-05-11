import { execSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const PACKAGES_DIR = join(import.meta.dirname, "..", "packages");

function getPackages(): string[] {
  return readdirSync(PACKAGES_DIR).filter((name) =>
    statSync(join(PACKAGES_DIR, name)).isDirectory(),
  );
}

function run(cmd: string, cwd?: string): void {
  execSync(cmd, { stdio: "inherit", cwd, env: { ...process.env } });
}

function build(): void {
  console.info("[paracosm] Building all packages...");

  run("pnpm install");

  const packages = getPackages();
  if (packages.length === 0) {
    console.info("[paracosm] No packages found in packages/");
    return;
  }

  run("turbo run build");

  console.info("[paracosm] Build complete.");
}

build();
