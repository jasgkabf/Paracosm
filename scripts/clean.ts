import { execSync } from "node:child_process";
import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT_DIR = join(import.meta.dirname, "..");
const PACKAGES_DIR = join(ROOT_DIR, "packages");

function getPackages(): string[] {
  return readdirSync(PACKAGES_DIR).filter((name) =>
    statSync(join(PACKAGES_DIR, name)).isDirectory(),
  );
}

function removeDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // directory may not exist
  }
}

function clean(): void {
  console.info("[paracosm] Cleaning all build artifacts...");

  const packages = getPackages();
  for (const pkg of packages) {
    const pkgDir = join(PACKAGES_DIR, pkg);
    removeDir(join(pkgDir, "dist"));
    removeDir(join(pkgDir, ".turbo"));
    removeDir(join(pkgDir, "coverage"));
    console.info(`[paracosm] Cleaned packages/${pkg}`);
  }

  removeDir(join(ROOT_DIR, ".turbo"));
  removeDir(join(ROOT_DIR, "node_modules"));

  console.info("[paracosm] Clean complete.");
}

clean();
