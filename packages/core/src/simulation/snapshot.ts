import type { SimulationSnapshot } from '@paracosm/shared';
import { generateId } from '@paracosm/shared';

export function createSnapshot(state: Record<string, unknown>, metrics?: Record<string, number>, events?: string[]): SimulationSnapshot {
  return {
    id: generateId(),
    timestamp: new Date(),
    state,
    metrics: metrics ?? {},
    events: events ?? [],
    metadata: {},
  };
}

export function compareSnapshots(a: SimulationSnapshot, b: SimulationSnapshot): { stateDiff: string[]; metricsDiff: Record<string, number>; newEvents: string[] } {
  const stateDiff: string[] = [];
  const allKeys = new Set([...Object.keys(a.state), ...Object.keys(b.state)]);
  for (const key of allKeys) {
    if (JSON.stringify(a.state[key]) !== JSON.stringify(b.state[key])) {
      stateDiff.push(key);
    }
  }
  const metricsDiff: Record<string, number> = {};
  const allMetricKeys = new Set([...Object.keys(a.metrics), ...Object.keys(b.metrics)]);
  for (const key of allMetricKeys) {
    const aVal = a.metrics[key] ?? 0;
    const bVal = b.metrics[key] ?? 0;
    if (aVal !== bVal) {
      metricsDiff[key] = bVal - aVal;
    }
  }
  const aEvents = new Set(a.events);
  const newEvents = b.events.filter((e) => !aEvents.has(e));
  return { stateDiff, metricsDiff, newEvents };
}

export function mergeSnapshots(snapshots: SimulationSnapshot[]): SimulationSnapshot {
  if (snapshots.length === 0) {
    return createSnapshot({});
  }
  const mergedState: Record<string, unknown> = {};
  const mergedMetrics: Record<string, number> = {};
  const mergedEvents: string[] = [];
  for (const snapshot of snapshots) {
    Object.assign(mergedState, snapshot.state);
    for (const [key, value] of Object.entries(snapshot.metrics)) {
      mergedMetrics[key] = (mergedMetrics[key] ?? 0) + value;
    }
    mergedEvents.push(...snapshot.events);
  }
  const count = snapshots.length;
  for (const key of Object.keys(mergedMetrics)) {
    mergedMetrics[key] /= count;
  }
  return createSnapshot(mergedState, mergedMetrics, [...new Set(mergedEvents)]);
}
