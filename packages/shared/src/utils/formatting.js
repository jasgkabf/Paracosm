export function formatTokens(tokens) {
    if (tokens >= 1_000_000) {
        return `${(tokens / 1_000_000).toFixed(2)}M`;
    }
    if (tokens >= 1_000) {
        return `${(tokens / 1_000).toFixed(1)}K`;
    }
    return String(tokens);
}
export function formatCost(cost, currency = 'USD') {
    if (cost < 0.01) {
        return `$${cost.toFixed(4)} ${currency}`;
    }
    if (cost < 1) {
        return `$${cost.toFixed(3)} ${currency}`;
    }
    return `$${cost.toFixed(2)} ${currency}`;
}
export function formatDuration(ms) {
    if (ms < 1000) {
        return `${ms.toFixed(0)}ms`;
    }
    if (ms < 60_000) {
        return `${(ms / 1000).toFixed(1)}s`;
    }
    if (ms < 3_600_000) {
        const minutes = Math.floor(ms / 60_000);
        const seconds = Math.floor((ms % 60_000) / 1000);
        return `${minutes}m ${seconds}s`;
    }
    const hours = Math.floor(ms / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    return `${hours}h ${minutes}m`;
}
export function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let size = bytes;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`;
}
export function formatBPM(bpm) {
    return `${Math.round(bpm)} BPM`;
}
//# sourceMappingURL=formatting.js.map