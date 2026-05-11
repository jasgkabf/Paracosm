import { RhythmType } from "@paracosm/shared";
import type { AnomalyAlert, HeartbeatEvent } from "@paracosm/shared";
import { HISTORY_RETENTION } from "@paracosm/shared";
import type { OperationalPhase } from "@paracosm/shared";
import type { HeartbeatStateInternal, HistoryBucket, AggregatedHeartbeat } from "./types.js";

export class HeartbeatHistory {
  private recentHistory: HistoryBucket[];
  private hourlyHistory: HistoryBucket[];
  private dailyHistory: HistoryBucket[];
  private events: HeartbeatEvent[];
  private maxRecentSize: number;
  private maxHourlySize: number;
  private maxDailySize: number;
  private lastRecordTime: number;
  private lastHourlyAggregation: number;
  private lastDailyAggregation: number;

  constructor() {
    this.recentHistory = [];
    this.hourlyHistory = [];
    this.dailyHistory = [];
    this.events = [];
    this.maxRecentSize = 3600;
    this.maxHourlySize = 360;
    this.maxDailySize = 1440;
    this.lastRecordTime = 0;
    this.lastHourlyAggregation = 0;
    this.lastDailyAggregation = 0;
  }

  record(state: HeartbeatStateInternal): void {
    const now = Date.now();
    const bucket: HistoryBucket = {
      timestamp: state.lastBeatAt,
      bpm: state.bpm,
      phase: state.operationalPhase,
      rhythm: state.rhythm,
      amplitude: state.amplitude,
      errorRate: state.vitalSigns.errorRate,
      cpuUsage: state.systemMetrics.cpuUsage,
      memoryUsage: state.systemMetrics.memoryUsage,
      activeConnections: state.systemMetrics.activeConnections,
      events: [],
    };

    this.recentHistory.push(bucket);
    if (this.recentHistory.length > this.maxRecentSize) {
      this.recentHistory.shift();
    }

    if (now - this.lastHourlyAggregation >= 10000) {
      this.aggregateToHourly();
      this.lastHourlyAggregation = now;
    }

    if (now - this.lastDailyAggregation >= 60000) {
      this.aggregateToDaily();
      this.lastDailyAggregation = now;
    }

    this.lastRecordTime = now;
  }

  private aggregateToHourly(): void {
    if (this.recentHistory.length === 0) return;

    const now = Date.now();
    const windowStart = now - HISTORY_RETENTION.hourlyMs;
    const relevant = this.recentHistory.filter(
      (b) => new Date(b.timestamp).getTime() >= windowStart
    );

    if (relevant.length === 0) return;

    const aggregated = this.aggregateBuckets(relevant, 10000);
    this.hourlyHistory = aggregated;
    if (this.hourlyHistory.length > this.maxHourlySize) {
      this.hourlyHistory = this.hourlyHistory.slice(-this.maxHourlySize);
    }
  }

  private aggregateToDaily(): void {
    if (this.hourlyHistory.length === 0 && this.recentHistory.length === 0) return;

    const now = Date.now();
    const windowStart = now - HISTORY_RETENTION.dailyMs;
    const allBuckets = [...this.recentHistory, ...this.hourlyHistory];
    const relevant = allBuckets.filter(
      (b) => new Date(b.timestamp).getTime() >= windowStart
    );

    if (relevant.length === 0) return;

    const aggregated = this.aggregateBuckets(relevant, 60000);
    this.dailyHistory = aggregated;
    if (this.dailyHistory.length > this.maxDailySize) {
      this.dailyHistory = this.dailyHistory.slice(-this.maxDailySize);
    }
  }

  private aggregateBuckets(buckets: HistoryBucket[], intervalMs: number): HistoryBucket[] {
    if (buckets.length === 0) return [];

    const result: HistoryBucket[] = [];
    const sorted = [...buckets].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let currentIntervalStart = new Date(sorted[0].timestamp).getTime();
    let currentBuckets: HistoryBucket[] = [];

    for (const bucket of sorted) {
      const bucketTime = new Date(bucket.timestamp).getTime();

      if (bucketTime - currentIntervalStart >= intervalMs) {
        if (currentBuckets.length > 0) {
          result.push(this.mergeBuckets(currentBuckets));
        }
        currentIntervalStart = bucketTime;
        currentBuckets = [bucket];
      } else {
        currentBuckets.push(bucket);
      }
    }

    if (currentBuckets.length > 0) {
      result.push(this.mergeBuckets(currentBuckets));
    }

    return result;
  }

  private mergeBuckets(buckets: HistoryBucket[]): HistoryBucket {
    const bpmValues = buckets.map((b) => b.bpm);
    const avgBpm = bpmValues.reduce((a, b) => a + b, 0) / bpmValues.length;

    const phaseCounts = new Map<OperationalPhase, number>();
    let maxPhaseCount = 0;
    let dominantPhase: OperationalPhase = "idle" as OperationalPhase;

    for (const bucket of buckets) {
      const count = (phaseCounts.get(bucket.phase) ?? 0) + 1;
      phaseCounts.set(bucket.phase, count);
      if (count > maxPhaseCount) {
        maxPhaseCount = count;
        dominantPhase = bucket.phase;
      }
    }

    const rhythmCounts = new Map<RhythmType, number>();
    let maxRhythmCount = 0;
    let dominantRhythm: RhythmType = RhythmType.Normal;

    for (const bucket of buckets) {
      const count = (rhythmCounts.get(bucket.rhythm) ?? 0) + 1;
      rhythmCounts.set(bucket.rhythm, count);
      if (count > maxRhythmCount) {
        maxRhythmCount = count;
        dominantRhythm = bucket.rhythm;
      }
    }

    return {
      timestamp: buckets[0].timestamp,
      bpm: Math.round(avgBpm),
      phase: dominantPhase,
      rhythm: dominantRhythm,
      amplitude: buckets.reduce((a, b) => a + b.amplitude, 0) / buckets.length,
      errorRate: buckets.reduce((a, b) => a + b.errorRate, 0) / buckets.length,
      cpuUsage: buckets.reduce((a, b) => a + b.cpuUsage, 0) / buckets.length,
      memoryUsage: buckets.reduce((a, b) => a + b.memoryUsage, 0) / buckets.length,
      activeConnections: Math.round(
        buckets.reduce((a, b) => a + b.activeConnections, 0) / buckets.length
      ),
      events: buckets.flatMap((b) => b.events),
    };
  }

  query(range: { start: string; end: string }): HistoryBucket[] {
    const startTime = new Date(range.start).getTime();
    const endTime = new Date(range.end).getTime();

    const allHistory = [...this.recentHistory, ...this.hourlyHistory, ...this.dailyHistory];
    const unique = new Map<string, HistoryBucket>();
    for (const bucket of allHistory) {
      unique.set(bucket.timestamp, bucket);
    }

    return Array.from(unique.values()).filter((bucket) => {
      const bucketTime = new Date(bucket.timestamp).getTime();
      return bucketTime >= startTime && bucketTime <= endTime;
    });
  }

  getRecent(durationMs?: number): HistoryBucket[] {
    const duration = durationMs ?? HISTORY_RETENTION.recentMs;
    const cutoff = Date.now() - duration;
    return this.recentHistory.filter(
      (b) => new Date(b.timestamp).getTime() >= cutoff
    );
  }

  getHourly(): HistoryBucket[] {
    return [...this.hourlyHistory];
  }

  getDaily(): HistoryBucket[] {
    return [...this.dailyHistory];
  }

  markEvent(type: string, description: string): void {
    const event: HeartbeatEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: type as any,
      timestamp: new Date().toISOString(),
      description,
      severity: "info",
      metricName: "",
      metricValue: 0,
      threshold: null,
      action: null,
    };

    this.events.push(event);

    if (this.recentHistory.length > 0) {
      this.recentHistory[this.recentHistory.length - 1].events.push(event);
    }

    if (this.events.length > 10000) {
      this.events.shift();
    }
  }

  replay(from: string, to: string): HistoryBucket[] {
    return this.query({ start: from, end: to });
  }

  downsample(data: HistoryBucket[], targetSize: number): HistoryBucket[] {
    if (data.length <= targetSize) return data;
    if (targetSize <= 0) return [];

    const step = data.length / targetSize;
    const result: HistoryBucket[] = [];

    for (let i = 0; i < targetSize; i++) {
      const startIdx = Math.floor(i * step);
      const endIdx = Math.min(Math.floor((i + 1) * step), data.length);
      const segment = data.slice(startIdx, endIdx);

      if (segment.length > 0) {
        result.push(this.mergeBuckets(segment));
      }
    }

    return result;
  }

  aggregate(data: HistoryBucket[], intervalMs: number): AggregatedHeartbeat[] {
    if (data.length === 0) return [];

    const result: AggregatedHeartbeat[] = [];
    const sorted = [...data].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let currentIntervalStart = new Date(sorted[0].timestamp).getTime();
    let currentBuckets: HistoryBucket[] = [];

    for (const bucket of sorted) {
      const bucketTime = new Date(bucket.timestamp).getTime();

      if (bucketTime - currentIntervalStart >= intervalMs) {
        if (currentBuckets.length > 0) {
          result.push(this.createAggregatedHeartbeat(currentBuckets));
        }
        currentIntervalStart = bucketTime;
        currentBuckets = [bucket];
      } else {
        currentBuckets.push(bucket);
      }
    }

    if (currentBuckets.length > 0) {
      result.push(this.createAggregatedHeartbeat(currentBuckets));
    }

    return result;
  }

  private createAggregatedHeartbeat(buckets: HistoryBucket[]): AggregatedHeartbeat {
    const bpmValues = buckets.map((b) => b.bpm);
    const avgBpm = bpmValues.reduce((a, b) => a + b, 0) / bpmValues.length;
    const minBpm = Math.min(...bpmValues);
    const maxBpm = Math.max(...bpmValues);

    const phaseCounts = new Map<OperationalPhase, number>();
    let maxPhaseCount = 0;
    let dominantPhase: OperationalPhase = "idle" as OperationalPhase;
    for (const bucket of buckets) {
      const count = (phaseCounts.get(bucket.phase) ?? 0) + 1;
      phaseCounts.set(bucket.phase, count);
      if (count > maxPhaseCount) {
        maxPhaseCount = count;
        dominantPhase = bucket.phase;
      }
    }

    const rhythmCounts = new Map<RhythmType, number>();
    let maxRhythmCount = 0;
    let dominantRhythm: RhythmType = RhythmType.Normal;
    for (const bucket of buckets) {
      const count = (rhythmCounts.get(bucket.rhythm) ?? 0) + 1;
      rhythmCounts.set(bucket.rhythm, count);
      if (count > maxRhythmCount) {
        maxRhythmCount = count;
        dominantRhythm = bucket.rhythm;
      }
    }

    return {
      startTime: buckets[0].timestamp,
      endTime: buckets[buckets.length - 1].timestamp,
      avgBpm: Math.round(avgBpm),
      minBpm,
      maxBpm,
      dominantPhase,
      dominantRhythm,
      avgAmplitude: buckets.reduce((a, b) => a + b.amplitude, 0) / buckets.length,
      avgErrorRate: buckets.reduce((a, b) => a + b.errorRate, 0) / buckets.length,
      avgCpuUsage: buckets.reduce((a, b) => a + b.cpuUsage, 0) / buckets.length,
      avgMemoryUsage: buckets.reduce((a, b) => a + b.memoryUsage, 0) / buckets.length,
      errorCount: buckets.reduce((sum, b) => sum + (b.errorRate > 0.2 ? 1 : 0), 0),
      beatCount: buckets.length,
    };
  }

  getEventHistory(): HeartbeatEvent[] {
    return [...this.events];
  }

  getRecentEventCount(durationMs?: number): number {
    const duration = durationMs ?? 60000;
    const cutoff = Date.now() - duration;
    return this.events.filter((e) => new Date(e.timestamp).getTime() >= cutoff).length;
  }

  getSize(): number {
    return this.recentHistory.length + this.hourlyHistory.length + this.dailyHistory.length;
  }

  getEventCount(): number {
    return this.events.length;
  }

  reset(): void {
    this.recentHistory = [];
    this.hourlyHistory = [];
    this.dailyHistory = [];
    this.events = [];
    this.lastRecordTime = 0;
    this.lastHourlyAggregation = 0;
    this.lastDailyAggregation = 0;
  }
}
