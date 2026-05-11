import { createLogger } from '@paracosm/shared';

const logger = createLogger('ConfigWatcher');

export class ConfigWatcher {
  private filePath: string;
  private onChange: () => void | Promise<void>;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastModified: number = 0;
  private watching: boolean = false;
  private pollInterval: number;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceMs: number;

  constructor(
    filePath: string,
    onChange: () => void | Promise<void>,
    options?: { pollInterval?: number; debounceMs?: number },
  ) {
    this.filePath = filePath;
    this.onChange = onChange;
    this.pollInterval = options?.pollInterval ?? 2000;
    this.debounceMs = options?.debounceMs ?? 500;
  }

  start(): void {
    if (this.watching) {
      logger.warn('ConfigWatcher already running');
      return;
    }

    this.watching = true;
    this.captureInitialState();

    this.intervalId = setInterval(() => {
      this.poll().catch((error) => {
        logger.error('ConfigWatcher poll error', { error: (error as Error).message });
      });
    }, this.pollInterval);

    logger.info('ConfigWatcher started', { path: this.filePath, interval: this.pollInterval });
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.watching = false;
    logger.info('ConfigWatcher stopped', { path: this.filePath });
  }

  isWatching(): boolean {
    return this.watching;
  }

  private async captureInitialState(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const stat = await fs.stat(this.filePath);
      this.lastModified = stat.mtimeMs;
    } catch {
      this.lastModified = 0;
    }
  }

  private async poll(): Promise<void> {
    if (!this.watching) return;

    try {
      const fs = await import('fs/promises');
      const stat = await fs.stat(this.filePath);
      const currentModified = stat.mtimeMs;

      if (currentModified > this.lastModified) {
        this.lastModified = currentModified;
        this.debouncedNotify();
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        logger.warn('Config file not found during watch', { path: this.filePath });
      } else {
        logger.error('ConfigWatcher stat error', { error: (error as Error).message });
      }
    }
  }

  private debouncedNotify(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      try {
        const result = this.onChange();
        if (result instanceof Promise) {
          result.catch((error) => {
            logger.error('ConfigWatcher onChange error', { error: (error as Error).message });
          });
        }
      } catch (error) {
        logger.error('ConfigWatcher onChange error', { error: (error as Error).message });
      }
    }, this.debounceMs);
  }

  async forceCheck(): Promise<boolean> {
    try {
      const fs = await import('fs/promises');
      const stat = await fs.stat(this.filePath);
      const currentModified = stat.mtimeMs;

      if (currentModified > this.lastModified) {
        this.lastModified = currentModified;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
