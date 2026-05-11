"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface VitalSigns {
  bpm: number;
  status: string;
  delay: number;
  uptime: number;
}

interface EngineStatus {
  name: string;
  activity: number;
  status: "active" | "idle" | "error";
}

interface ProviderStatus {
  name: string;
  connected: boolean;
  latency: number;
  errorRate: number;
}

interface ResourceUsage {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

interface BpmHistoryPoint {
  timestamp: number;
  bpm: number;
  event?: string;
}

interface UseHeartbeatReturn {
  vitalSigns: VitalSigns;
  connectionStatus: "online" | "disconnected" | "reconnecting";
  engineStatus: EngineStatus[];
  providerStatus: ProviderStatus[];
  resourceUsage: ResourceUsage;
  bpmHistory: BpmHistoryPoint[];
  isConnected: boolean;
  reconnect: () => void;
}

export function useHeartbeat(): UseHeartbeatReturn {
  const [vitalSigns, setVitalSigns] = useState<VitalSigns>({
    bpm: 72,
    status: "normal",
    delay: 45,
    uptime: 0,
  });
  const [connectionStatus, setConnectionStatus] = useState<"online" | "disconnected" | "reconnecting">("online");
  const [engineStatus, setEngineStatus] = useState<EngineStatus[]>([
    { name: "Orchestrator", activity: 78, status: "active" },
    { name: "World Model", activity: 45, status: "active" },
    { name: "Simulation", activity: 0, status: "idle" },
    { name: "Strategy", activity: 32, status: "active" },
    { name: "Memory", activity: 56, status: "active" },
    { name: "LLM Gateway", activity: 89, status: "active" },
  ]);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus[]>([
    { name: "OpenAI", connected: true, latency: 245, errorRate: 0.02 },
    { name: "Anthropic", connected: true, latency: 312, errorRate: 0.01 },
    { name: "Google", connected: false, latency: 0, errorRate: 0 },
    { name: "Local (Ollama)", connected: true, latency: 45, errorRate: 0 },
  ]);
  const [resourceUsage, setResourceUsage] = useState<ResourceUsage>({
    cpu: 45,
    memory: 62,
    disk: 33,
    network: 18,
  });
  const [bpmHistory, setBpmHistory] = useState<BpmHistoryPoint[]>([]);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const uptime = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const bpmVariation = Math.round(72 + (Math.random() - 0.5) * 8);
      const delay = Math.round(40 + Math.random() * 20);

      setVitalSigns((prev) => ({
        ...prev,
        bpm: bpmVariation,
        delay,
        uptime,
        status: bpmVariation > 90 ? "elevated" : bpmVariation < 50 ? "low" : "normal",
      }));

      setBpmHistory((prev) => {
        const newPoint: BpmHistoryPoint = {
          timestamp: Date.now(),
          bpm: bpmVariation,
        };
        const updated = [...prev, newPoint];
        return updated.slice(-60);
      });

      setEngineStatus((prev) =>
        prev.map((engine) => ({
          ...engine,
          activity: engine.status === "idle"
            ? 0
            : Math.max(0, Math.min(100, engine.activity + (Math.random() - 0.5) * 10)),
        }))
      );

      setResourceUsage((prev) => ({
        cpu: Math.max(0, Math.min(100, prev.cpu + (Math.random() - 0.5) * 5)),
        memory: Math.max(0, Math.min(100, prev.memory + (Math.random() - 0.5) * 3)),
        disk: Math.max(0, Math.min(100, prev.disk + (Math.random() - 0.5) * 1)),
        network: Math.max(0, Math.min(100, prev.network + (Math.random() - 0.5) * 8)),
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const reconnect = useCallback(() => {
    setConnectionStatus("reconnecting");
    setTimeout(() => {
      setConnectionStatus("online");
    }, 1500);
  }, []);

  return {
    vitalSigns,
    connectionStatus,
    engineStatus,
    providerStatus,
    resourceUsage,
    bpmHistory,
    isConnected: connectionStatus === "online",
    reconnect,
  };
}
