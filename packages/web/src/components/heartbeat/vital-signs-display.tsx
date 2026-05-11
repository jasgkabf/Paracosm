'use client';

import type { RhythmType, HeartPhase } from '@paracosm/shared';

interface VitalSignsDisplayProps {
  bpm: number;
  rhythm: RhythmType;
  oxygenSaturation: number;
  delay: number;
  uptime: number;
}

const rhythmColors: Record<RhythmType, string> = {
  normal: 'text-paracosm-green',
  elevated: 'text-yellow-400',
  stressed: 'text-orange-400',
  calm: 'text-paracosm-cyan',
  irregular: 'text-red-400',
  recovery: 'text-yellow-400',
  tachycardic: 'text-red-400',
  bradycardic: 'text-paracosm-cyan',
};

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function VitalSignsDisplay({
  bpm,
  rhythm,
  oxygenSaturation,
  delay,
  uptime,
}: VitalSignsDisplayProps) {
  const rhythmColor = rhythmColors[rhythm] ?? 'text-paracosm-green';

  return (
    <div className="glass-panel p-4 space-y-4">
      <div className="text-xs font-mono text-paracosm-muted uppercase tracking-wider">
        Vital Signs
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-paracosm-muted font-mono">BPM</span>
          <span className="text-3xl font-mono font-bold ecg-glow-text text-paracosm-green">
            {bpm}
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-xs text-paracosm-muted font-mono">Rhythm</span>
          <span className={`text-sm font-mono font-medium ${rhythmColor} capitalize`}>
            {rhythm}
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-xs text-paracosm-muted font-mono">SpO2</span>
          <span className="text-lg font-mono font-medium text-paracosm-cyan">
            {oxygenSaturation}%
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-xs text-paracosm-muted font-mono">Delay</span>
          <span className="text-sm font-mono text-paracosm-muted">
            {delay.toFixed(0)}ms
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-xs text-paracosm-muted font-mono">Uptime</span>
          <span className="text-sm font-mono text-paracosm-muted">
            {formatUptime(uptime)}
          </span>
        </div>
      </div>
    </div>
  );
}
