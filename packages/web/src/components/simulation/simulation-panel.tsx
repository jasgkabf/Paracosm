'use client';

import { useState } from 'react';
import { Card } from '@/components/common/card';
import { Button } from '@/components/common/button';
import { Badge } from '@/components/common/badge';
import { Progress } from '@/components/common/progress';
import { IconBrain, IconPlay, IconRefresh } from '@/components/icons';

interface SimulationRun {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  progress: number;
  pathsExplored: number;
  bestScore: number;
}

export function SimulationPanel() {
  const [simulations] = useState<SimulationRun[]>([
    { id: '1', name: 'Market Analysis', status: 'completed', progress: 100, pathsExplored: 47, bestScore: 0.89 },
    { id: '2', name: 'Risk Assessment', status: 'running', progress: 62, pathsExplored: 31, bestScore: 0.74 },
    { id: '3', name: 'Resource Planning', status: 'idle', progress: 0, pathsExplored: 0, bestScore: 0 },
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button size="sm">
          <IconPlay size={14} />
          New Simulation
        </Button>
        <Button variant="secondary" size="sm">
          <IconRefresh size={14} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {simulations.map((sim) => (
          <Card key={sim.id} glow={sim.status === 'running' ? 'green' : 'none'}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <IconBrain size={16} color="#00d4ff" />
                <span className="text-sm font-medium text-paracosm-text">{sim.name}</span>
              </div>
              <Badge
                variant={
                  sim.status === 'completed'
                    ? 'success'
                    : sim.status === 'running'
                    ? 'info'
                    : sim.status === 'failed'
                    ? 'danger'
                    : 'default'
                }
              >
                {sim.status}
              </Badge>
            </div>

            <Progress
              value={sim.progress}
              max={100}
              color={sim.status === 'completed' ? 'green' : 'cyan'}
              size="md"
              showLabel
            />

            <div className="flex justify-between mt-3 text-xs text-paracosm-muted font-mono">
              <span>Paths: {sim.pathsExplored}</span>
              <span>Score: {sim.bestScore.toFixed(2)}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
