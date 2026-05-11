export function formatTokens(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens < 0) {
    return "0";
  }
  if (tokens >= 1_000_000_000) {
    return `${(tokens / 1_000_000_000).toFixed(1)}B`;
  }
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

export function formatCost(cost: number): string {
  if (!Number.isFinite(cost) || cost < 0) {
    return "$0.00";
  }
  if (cost === 0) {
    return "$0.00";
  }
  if (cost < 0.001) {
    return `$${cost.toFixed(6)}`;
  }
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  if (cost < 1) {
    return `$${cost.toFixed(3)}`;
  }
  if (cost < 1000) {
    return `$${cost.toFixed(2)}`;
  }
  return `$${formatNumber(cost)}`;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    return "0ms";
  }
  if (ms < 1) {
    return `${ms.toFixed(2)}ms`;
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }
  if (bytes === 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  if (exponent === 0) {
    return `${Math.round(value)} ${units[0]}`;
  }
  return `${value.toFixed(exponent > 2 ? 2 : 1)} ${units[exponent]}`;
}

export function formatDate(date: Date | number): string {
  const d = typeof date === "number" ? new Date(date) : date;
  if (!(d instanceof Date) || isNaN(d.getTime())) {
    return "Invalid Date";
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function formatNumber(num: number): string {
  if (!Number.isFinite(num)) {
    return "NaN";
  }
  if (Math.abs(num) >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (Math.abs(num) >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(num) >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  if (Number.isInteger(num)) {
    return num.toString();
  }
  const absNum = Math.abs(num);
  if (absNum < 0.001) {
    return num.toExponential(2);
  }
  if (absNum < 1) {
    return num.toFixed(4);
  }
  return num.toFixed(2);
}

export function formatPercentage(value: number, decimals: number = 1): string {
  if (!Number.isFinite(value)) {
    return "NaN%";
  }
  return `${value.toFixed(decimals)}%`;
}

export function formatBPM(bpm: number): string {
  if (!Number.isFinite(bpm) || bpm < 0) {
    return "0 BPM";
  }
  return `${Math.round(bpm)} BPM`;
}
