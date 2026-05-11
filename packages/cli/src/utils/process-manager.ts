import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const PID_DIR = join(homedir(), ".paracosm");
const PID_FILE = join(PID_DIR, "paracosm.pid");
const LOG_FILE = join(PID_DIR, "paracosm.log");

async function ensurePidDir(): Promise<void> {
  if (!existsSync(PID_DIR)) {
    await mkdir(PID_DIR, { recursive: true });
  }
}

export async function getDaemonPid(): Promise<number | null> {
  try {
    if (!existsSync(PID_FILE)) return null;
    const content = await readFile(PID_FILE, "utf-8");
    const pid = parseInt(content.trim(), 10);
    if (isNaN(pid)) return null;

    try {
      process.kill(pid, 0);
      return pid;
    } catch {
      await unlink(PID_FILE).catch(() => {});
      return null;
    }
  } catch {
    return null;
  }
}

export async function isRunning(): Promise<boolean> {
  const pid = await getDaemonPid();
  return pid !== null;
}

export async function startDaemon(
  port: number,
  host: string = "0.0.0.0"
): Promise<void> {
  if (await isRunning()) {
    throw new Error("Daemon is already running");
  }

  await ensurePidDir();

  const out = await import("node:fs");
  const logStream = out.createWriteStream(LOG_FILE, { flags: "a" });

  const child = spawn(
    process.execPath,
    [join(process.cwd(), "dist", "server.js")],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        HOST: host,
        PARACOSM_DAEMON: "1",
      },
      stdio: ["ignore", logStream, logStream],
      detached: true,
    }
  );

  child.unref();

  await writeFile(PID_FILE, String(child.pid), "utf-8");

  const maxAttempts = 20;
  const delayMs = 250;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    try {
      const response = await fetch(`http://localhost:${port}/api/v1/heartbeat`);
      if (response.ok) return;
    } catch {
      continue;
    }
  }

  throw new Error("Daemon failed to start within the expected time");
}

export async function stopDaemon(force: boolean = false): Promise<void> {
  const pid = await getDaemonPid();
  if (pid === null) {
    throw new Error("Daemon is not running");
  }

  const signal = force ? "SIGKILL" : "SIGTERM";

  try {
    process.kill(pid, signal);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ESRCH") {
      await unlink(PID_FILE).catch(() => {});
      return;
    }
    throw error;
  }

  if (!force) {
    const maxAttempts = 30;
    const delayMs = 200;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      try {
        process.kill(pid, 0);
      } catch {
        await unlink(PID_FILE).catch(() => {});
        return;
      }
    }

    process.kill(pid, "SIGKILL");
  }

  await unlink(PID_FILE).catch(() => {});
}

export { PID_FILE, LOG_FILE, PID_DIR };
