import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';

interface StatusDashboardProps {
  heartbeatOnly?: boolean;
}

interface HeartbeatData {
  bpm: number;
  rhythm: string;
  phase: string;
  cpuUsage: number;
  memoryUsage: number;
  uptime: number;
  providers: Array<{ provider: string; available: boolean; latencyMs: number }>;
}

export function StatusDashboard({ heartbeatOnly = false }: StatusDashboardProps) {
  const [data, setData] = useState<HeartbeatData | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { exit } = useApp();

  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout>;

    const connect = () => {
      try {
        ws = new WebSocket('ws://localhost:7529/api/v1/ws');
        ws.onopen = () => setConnected(true);
        ws.onclose = () => {
          setConnected(false);
          timer = setTimeout(connect, 5000);
        };
        ws.onerror = () => ws?.close();
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'heartbeat' && msg.payload) {
              const p = msg.payload;
              setData({
                bpm: p.vitalSigns?.bpm ?? 0,
                rhythm: p.vitalSigns?.rhythm ?? 'unknown',
                phase: p.engineStatus?.phase ?? 'unknown',
                cpuUsage: p.systemMetrics?.cpuUsage ?? 0,
                memoryUsage: p.systemMetrics?.memoryUsage ?? 0,
                uptime: p.systemMetrics?.uptime ?? 0,
                providers: p.providerStatuses ?? [],
              });
            }
          } catch {}
        };
      } catch {
        timer = setTimeout(connect, 5000);
      }
    };

    const fetchOnce = async () => {
      try {
        const res = await fetch('http://localhost:7529/api/v1/heartbeat');
        if (res.ok) {
          const d = await res.json();
          setData({
            bpm: d.vitalSigns?.bpm ?? 72,
            rhythm: d.vitalSigns?.rhythm ?? 'normal',
            phase: d.engineStatus?.phase ?? 'rest',
            cpuUsage: d.systemMetrics?.cpuUsage ?? 0,
            memoryUsage: d.systemMetrics?.memoryUsage ?? 0,
            uptime: d.systemMetrics?.uptime ?? 0,
            providers: d.providerStatuses ?? [],
          });
          setConnected(true);
        } else {
          setError(`HTTP ${res.status}`);
        }
      } catch {
        setError('Cannot connect to server');
      }
    };

    fetchOnce();
    connect();

    return () => {
      ws?.close();
      clearTimeout(timer);
    };
  }, []);

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const bar = (pct: number, width = 20) => {
    const filled = Math.round(pct * width);
    return '[' + '#'.repeat(filled) + '-'.repeat(width - filled) + ']';
  };

  if (error && !data) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red" bold>Connection Error</Text>
        <Text color="gray">{error}</Text>
        <Text color="gray">Is the server running? Try: paracosm serve</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box>
        <Text bold color="green">Paracosm Status</Text>
        <Text> | </Text>
        <Text color={connected ? 'green' : 'red'}>{connected ? 'CONNECTED' : 'DISCONNECTED'}</Text>
      </Box>

      {data && (
        <>
          <Box marginTop={1} flexDirection="column">
            <Text bold>Heartbeat</Text>
            <Text>  BPM: <Text color="green" bold>{data.bpm}</Text>  Rhythm: <Text color="cyan">{data.rhythm}</Text>  Phase: <Text color="yellow">{data.phase}</Text></Text>
            <Text>  Uptime: {formatUptime(data.uptime)}</Text>
          </Box>

          {!heartbeatOnly && (
            <>
              <Box marginTop={1} flexDirection="column">
                <Text bold>Resources</Text>
                <Text>  CPU:    {bar(data.cpuUsage)} {(data.cpuUsage * 100).toFixed(1)}%</Text>
                <Text>  Memory: {bar(data.memoryUsage)} {(data.memoryUsage * 100).toFixed(1)}%</Text>
              </Box>

              {data.providers.length > 0 && (
                <Box marginTop={1} flexDirection="column">
                  <Text bold>Providers</Text>
                  {data.providers.map((p) => (
                    <Text key={p.provider}>
                      {'  '}{p.provider.padEnd(12)} <Text color={p.available ? 'green' : 'red'}>{p.available ? 'ONLINE' : 'OFFLINE'}</Text> {p.latencyMs.toFixed(0)}ms
                    </Text>
                  ))}
                </Box>
              )}
            </>
          )}
        </>
      )}

      <Box marginTop={1}>
        <Text color="gray">Press Esc to exit</Text>
      </Box>
    </Box>
  );
}
