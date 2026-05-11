import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';

const RUN_DIR = join(process.env.HOME ?? '~', '.paracosm', 'run');

export class ProcessManager {
  pidPath: string;

  constructor() {
    this.pidPath = join(RUN_DIR, 'server.pid');
  }

  async start(options: { port: number; host: string }): Promise<number> {
    await mkdir(RUN_DIR, { recursive: true });

    const { spawn } = await import('child_process');
    const apiPath = require.resolve('@paracosm/api');

    const child = spawn('node', [apiPath], {
      env: {
        ...process.env,
        PORT: String(options.port),
        HOST: options.host,
      },
      detached: true,
      stdio: 'ignore',
    });

    child.unref();

    const pid = child.pid;
    if (!pid) throw new Error('Failed to start server process');

    await writeFile(this.pidPath, String(pid), 'utf-8');

    return pid;
  }

  async stop(): Promise<void> {
    try {
      const pidStr = await readFile(this.pidPath, 'utf-8');
      const pid = parseInt(pidStr.trim(), 10);

      if (isNaN(pid)) {
        throw new Error('Invalid PID');
      }

      process.kill(pid, 'SIGTERM');

      try {
        await unlink(this.pidPath);
      } catch {}
    } catch {
      throw new Error('No running server found');
    }
  }

  async isRunning(): Promise<boolean> {
    try {
      const pidStr = await readFile(this.pidPath, 'utf-8');
      const pid = parseInt(pidStr.trim(), 10);

      if (isNaN(pid)) return false;

      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }
}
