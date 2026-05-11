'use client';

import type { HeartPhase } from '@paracosm/shared';
import { Progress } from '@/components/common/progress';

interface EngineStatusPanelProps {
  phase: HeartPhase;
  iteration: number;
  activePersonas: number;
  activeSimulations: number;
  pendingGoals: number;
  completedGoals: number;
}

const phaseLabels: Record<HeartPhase, string> = {
  systole: 'SYSTOLE',
  diastole: 'DIASTOLE',
  contraction: 'CONTRACTION',
  relaxation: 'RELAXATION',
  rest: 'REST',
};

const phaseColors: Record<HeartPhase, string> = {
  systole: 'text-paracosm-green',
  diastole: 'text-paracosm-cyan',
  contraction: 'text-yellow-400',
  relaxation: 'text-paracosm-cyan',
  rest: 'text-paracosm-muted',
};

export function EngineStatusPanel({
  phase,
  iteration,
  activePersonas,
  activeSimulations,
  pendingGoals,
  completedGoals,
}: EngineStatusPanelProps) {
  return (
    <div className="glass-panel p-4 space-y-4">
      <div className="text-xs font-mono text-paracosm-muted uppercase tracking-wider">
        Engine Status
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-xs text-paracosm-muted font-mono">Phase</span>
        <span className={`text-sm font-mono font-bold ${phaseColors[phase]}`}>
          {phaseLabels[phase]}
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-paracosm-muted font-mono">Iteration</span>
            <span className="text-paracosm-text font-mono">{iteration}</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-paracosm-muted font-mono">Active Personas</span>
            <span className="text-paracosm-green font-mono">{activePersonas}</span>
          </div>
          <Progress value={activePersonas} max={5} color="green" size="sm" />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-paracosm-muted font-mono">Simulations</span>
            <span className="text-paracosm-cyan font-mono">{activeSimulations}</span>
          </div>
          <Progress value={activeSimulations} max={10} color="cyan" size="sm" />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-paracosm-muted font-mono">Goals</span>
            <span className="text-paracosm-text font-mono">
              {completedGoals}/{pendingGoals + completedGoals}
            </span>
          </div>
          <Progress
            value={completedGoals}
            max={Math.max(pendingGoals + completedGoals, 1)}
            color="green"
            size="sm"
          />
        </div>
      </div>
    </div>
  );
}
