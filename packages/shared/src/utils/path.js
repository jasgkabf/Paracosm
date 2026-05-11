import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
const APP_DIR = '.paracosm';
function getBaseDir() {
    return homedir();
}
export function getConfigDir() {
    const dir = join(getBaseDir(), APP_DIR, 'config');
    ensureDir(dir);
    return dir;
}
export function getDataDir() {
    const dir = join(getBaseDir(), APP_DIR, 'data');
    ensureDir(dir);
    return dir;
}
export function getCacheDir() {
    const dir = join(getBaseDir(), APP_DIR, 'cache');
    ensureDir(dir);
    return dir;
}
export function ensureDir(dirPath) {
    if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
    }
}
//# sourceMappingURL=path.js.map