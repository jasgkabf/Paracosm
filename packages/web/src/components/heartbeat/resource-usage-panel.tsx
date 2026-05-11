'use client';

import { Progress } from '@/components/common/progress';

interface ResourceUsagePanelProps {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getUsageColor(usage: number): 'green' | 'yellow' | 'red' {
  if (usage < 0.7) return 'green';
  if (usage < 0.9) return 'yellow';
  return 'red';
}

export function ResourceUsagePanel({
  cpuUsage,
  memoryUsage,
  diskUsage,
  networkIn,
  networkOut,
}: ResourceUsagePanelProps) {
  return (
    <div className="glass-panel p-4">
      <div className="text-xs font-mono text-paracosm-muted uppercase tracking-wider mb-4">
        Resource Usage
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-paracosm-muted font-mono">CPU</span>
            <span className="text-paracosm-text font-mono">{(cpuUsage * 100).toFixed(1)}%</span>
          </div>
          <Progress
            value={cpuUsage * 100}
            max={100}
            color={getUsageColor(cpuUsage)}
            size="sm"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-paracosm-muted font-mono">Memory</span>
            <span className="text-paracosm-text font-mono">{(memoryUsage * 100).toFixed(1)}%</span>
          </div>
          <Progress
            value={memoryUsage * 100}
            max={100}
            color={getUsageColor(memoryUsage)}
            size="sm"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-paracosm-muted font-mono">Disk</span>
            <span className="text-paracosm-text font-mono">{(diskUsage * 100).toFixed(1)}%</span>
          </div>
          <Progress
            value={diskUsage * 100}
            max={100}
            color={getUsageColor(diskUsage)}
            size="sm"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-paracosm-muted font-mono">Net In</span>
            <span className="text-paracosm-text font-mono">{formatBytes(networkIn)}/s</span>
          </div>
          <Progress value={Math.min(networkIn / 1000000 * 100, 100)} max={100} color="cyan" size="sm" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-paracosm-muted font-mono">Net Out</span>
            <span className="text-paracosm-text font-mono">{formatBytes(networkOut)}/s</span>
          </div>
          <Progress value={Math.min(networkOut / 1000000 * 100, 100)} max={100} color="cyan" size="sm" />
        </div>
      </div>
    </div>
  );
}
