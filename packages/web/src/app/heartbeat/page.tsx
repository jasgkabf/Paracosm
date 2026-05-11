"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { HeartbeatPanel } from "@/components/heartbeat/heartbeat-panel";
import { EcgCanvas } from "@/components/heartbeat/ecg-canvas";
import { VitalSignsDisplay } from "@/components/heartbeat/vital-signs-display";
import { EngineStatusPanel } from "@/components/heartbeat/engine-status-panel";
import { ProviderStatusPanel } from "@/components/heartbeat/provider-status-panel";
import { ResourceUsagePanel } from "@/components/heartbeat/resource-usage-panel";
import { HeartbeatHistoryChart } from "@/components/heartbeat/heartbeat-history-chart";
import { ConnectionIndicator } from "@/components/heartbeat/connection-indicator";
import { Badge } from "@/components/common/badge";
import { useHeartbeat } from "@/hooks/use-heartbeat";

export default function HeartbeatPage() {
  const { vitalSigns, connectionStatus, engineStatus, providerStatus, resourceUsage, bpmHistory } = useHeartbeat();

  return (
    <AppLayout>
      <div className="flex flex-col h-full p-6 gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-white">Heartbeat Monitor</h1>
              <p className="text-sm text-gray-400 mt-1">
                Real-time system health and vital signs
              </p>
            </div>
            <ConnectionIndicator status={connectionStatus} />
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={vitalSigns.bpm > 0 ? "success" : "error"}>
              {vitalSigns.bpm > 0 ? "ALIVE" : "FLATLINE"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <div className="xl:col-span-3">
            <EcgCanvas
              bpm={vitalSigns.bpm}
              status={vitalSigns.status}
            />
          </div>
          <div>
            <VitalSignsDisplay vitalSigns={vitalSigns} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
          <div className="min-h-0 overflow-y-auto">
            <EngineStatusPanel engines={engineStatus} />
          </div>
          <div className="min-h-0 overflow-y-auto">
            <ProviderStatusPanel providers={providerStatus} />
          </div>
          <div className="min-h-0 overflow-y-auto">
            <ResourceUsagePanel resources={resourceUsage} />
          </div>
        </div>

        <div className="glass-panel p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">BPM History</h3>
          <HeartbeatHistoryChart data={bpmHistory} />
        </div>
      </div>
    </AppLayout>
  );
}
