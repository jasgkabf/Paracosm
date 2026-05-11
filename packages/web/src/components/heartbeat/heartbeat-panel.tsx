"use client";

import { EcgCanvas } from "./ecg-canvas";
import { VitalSignsDisplay } from "./vital-signs-display";
import { EngineStatusPanel } from "./engine-status-panel";
import { ProviderStatusPanel } from "./provider-status-panel";
import { ResourceUsagePanel } from "./resource-usage-panel";
import { HeartbeatHistoryChart } from "./heartbeat-history-chart";
import { ConnectionIndicator } from "./connection-indicator";
import { Badge } from "@/components/common/badge";

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

interface HeartbeatPanelProps {
  vitalSigns?: VitalSigns;
  engineStatus?: EngineStatus[];
  providerStatus?: ProviderStatus[];
  resourceUsage?: ResourceUsage;
  bpmHistory?: BpmHistoryPoint[];
  connectionStatus?: "online" | "disconnected" | "reconnecting";
}

export function HeartbeatPanel({
  vitalSigns = { bpm: 72, status: "normal", delay: 45, uptime: 3600 },
  engineStatus = [],
  providerStatus = [],
  resourceUsage = { cpu: 45, memory: 62, disk: 33, network: 18 },
  bpmHistory = [],
  connectionStatus = "online",
}: HeartbeatPanelProps) {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">Heartbeat Monitor</h2>
          <ConnectionIndicator status={connectionStatus} />
        </div>
        <Badge variant={vitalSigns.bpm > 0 ? "success" : "error"}>
          {vitalSigns.bpm > 0 ? "ALIVE" : "FLATLINE"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="xl:col-span-3">
          <div className="glass-panel p-2 ecg-glow-box">
            <EcgCanvas bpm={vitalSigns.bpm} status={vitalSigns.status} />
          </div>
        </div>
        <div>
          <VitalSignsDisplay vitalSigns={vitalSigns} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <EngineStatusPanel engines={engineStatus} />
        <ProviderStatusPanel providers={providerStatus} />
        <ResourceUsagePanel resources={resourceUsage} />
      </div>

      {bpmHistory.length > 0 && (
        <div className="glass-panel p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">BPM History</h3>
          <HeartbeatHistoryChart data={bpmHistory} />
        </div>
      )}
    </div>
  );
}
