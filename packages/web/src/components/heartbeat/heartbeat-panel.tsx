'use client';

import { EcgCanvas } from './ecg-canvas';
import { VitalSignsDisplay } from './vital-signs-display';
import { EngineStatusPanel } from './engine-status-panel';
import { ProviderStatusPanel } from './provider-status-panel';
import { ResourceUsagePanel } from './resource-usage-panel';
import { ConnectionIndicator } from './connection-indicator';
import { useHeartbeat } from '@/hooks/use-heartbeat';

export function HeartbeatPanel() {
  const { state, connected } = useHeartbeat();

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-paracosm-text">Heartbeat</h1>
          <ConnectionIndicator connected={connected} />
        </div>
        <div className="text-xs text-paracosm-muted font-mono">
          SYSTEM MONITOR v0.1
        </div>
      </div>

      <div className="glass-panel glow-border p-4">
        <EcgCanvas
          bpm={state?.vitalSigns?.bpm ?? 72}
          rhythm={state?.vitalSigns?.rhythm ?? 'normal'}
          width={800}
          height={200}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <VitalSignsDisplay
          bpm={state?.vitalSigns?.bpm ?? 72}
          rhythm={state?.vitalSigns?.rhythm ?? 'normal'}
          oxygenSaturation={state?.vitalSigns?.oxygenSaturation ?? 98}
          delay={state?.systemMetrics?.requestRate ?? 0}
          uptime={state?.systemMetrics?.uptime ?? 0}
        />
        <EngineStatusPanel
          phase={state?.engineStatus?.phase ?? 'rest'}
          iteration={state?.engineStatus?.iteration ?? 0}
          activePersonas={state?.engineStatus?.activePersonas ?? 0}
          activeSimulations={state?.engineStatus?.activeSimulations ?? 0}
          pendingGoals={state?.engineStatus?.pendingGoals ?? 0}
          completedGoals={state?.engineStatus?.completedGoals ?? 0}
        />
        <ProviderStatusPanel
          providers={state?.providerStatuses ?? []}
        />
      </div>

      <ResourceUsagePanel
        cpuUsage={state?.systemMetrics?.cpuUsage ?? 0}
        memoryUsage={state?.systemMetrics?.memoryUsage ?? 0}
        diskUsage={state?.systemMetrics?.diskUsage ?? 0}
        networkIn={state?.systemMetrics?.networkIn ?? 0}
        networkOut={state?.systemMetrics?.networkOut ?? 0}
      />
    </div>
  );
}
