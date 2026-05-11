'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { HeartbeatState, RhythmType } from '@paracosm/shared';

const DEFAULT_STATE: Partial<HeartbeatState> = {
  vitalSigns: {
    bpm: 72,
    rhythm: 'normal' as RhythmType,
    bloodPressure: { systolic: 120, diastolic: 80 },
    oxygenSaturation: 98,
    temperature: 37.0,
    timestamp: new Date(),
  },
  systemMetrics: {
    cpuUsage: 0.35,
    memoryUsage: 0.42,
    diskUsage: 0.28,
    networkIn: 1024,
    networkOut: 512,
    activeConnections: 3,
    requestRate: 12.5,
    errorRate: 0.01,
    uptime: 86400,
    timestamp: new Date(),
  },
  engineStatus: {
    phase: 'rest',
    iteration: 0,
    activePersonas: 2,
    activeSimulations: 1,
    pendingGoals: 3,
    completedGoals: 7,
    tokenBudgetRemaining: 85000,
    lastCycleDuration: 1200,
    timestamp: new Date(),
  },
  providerStatuses: [
    {
      provider: 'openai',
      available: true,
      latencyMs: 340,
      errorRate: 0.02,
      quotaRemaining: 45000,
      quotaTotal: 100000,
      lastRequestAt: new Date(),
      timestamp: new Date(),
    },
    {
      provider: 'anthropic',
      available: true,
      latencyMs: 420,
      errorRate: 0.01,
      quotaRemaining: 30000,
      quotaTotal: 50000,
      lastRequestAt: new Date(),
      timestamp: new Date(),
    },
  ],
  anomalies: [],
};

export function useHeartbeat() {
  const [state, setState] = useState<Partial<HeartbeatState> | null>(DEFAULT_STATE);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(`ws://${window.location.host}/api/v1/ws`);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        reconnectRef.current = setTimeout(connect, 5000);
      };
      ws.onerror = () => ws.close();

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'heartbeat') {
            setState(data.payload);
          }
        } catch {}
      };
    } catch {
      reconnectRef.current = setTimeout(connect, 5000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connect]);

  return { state, connected };
}
