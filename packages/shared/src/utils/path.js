"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfigDir = getConfigDir;
exports.getDataDir = getDataDir;
exports.getCacheDir = getCacheDir;
exports.ensureDir = ensureDir;
const os_1 = require("os");
const path_1 = require("path");
const fs_1 = require("fs");
const APP_DIR = '.paracosm';
function getBaseDir() {
    return (0, os_1.homedir)();
}
function getConfigDir() {
    const dir = (0, path_1.join)(getBaseDir(), APP_DIR, 'config');
    ensureDir(dir);
    return dir;
}
function getDataDir() {
    const dir = (0, path_1.join)(getBaseDir(), APP_DIR, 'data');
    ensureDir(dir);
    return dir;
}
function getCacheDir() {
    const dir = (0, path_1.join)(getBaseDir(), APP_DIR, 'cache');
    ensureDir(dir);
    return dir;
}
function ensureDir(dirPath) {
    if (!(0, fs_1.existsSync)(dirPath)) {
        (0, fs_1.mkdirSync)(dirPath, { recursive: true });
    }
}
//# sourceMappingURL=path.js.map