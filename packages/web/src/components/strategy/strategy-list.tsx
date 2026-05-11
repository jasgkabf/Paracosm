'use client';

import { Card } from '@/components/common/card';
import { Badge } from '@/components/common/badge';
import { Progress } from '@/components/common/progress';
import { IconDna } from '@/components/icons';

interface Strategy {
  id: string;
  name: string;
  generation: number;
  fitness: number;
  status: 'active' | 'evolving' | 'retired';
  genes: number;
}

const MOCK_STRATEGIES: Strategy[] = [
  { id: '1', name: 'Conservative Approach', generation: 12, fitness: 0.92, status: 'active', genes: 8 },
  { id: '2', name: 'Aggressive Expansion', generation: 8, fitness: 0.78, status: 'evolving', genes: 12 },
  { id: '3', name: 'Balanced Strategy', generation: 15, fitness: 0.85, status: 'active', genes: 10 },
  { id: '4', name: 'Risk-Averse Path', generation: 3, fitness: 0.61, status: 'evolving', genes: 6 },
  { id: '5', name: 'Legacy Alpha', generation: 20, fitness: 0.45, status: 'retired', genes: 14 },
];

const statusVariant: Record<string, 'success' | 'info' | 'default'> = {
  active: 'success',
  evolving: 'info',
  retired: 'default',
};

export function StrategyList() {
  return (
    <div className="space-y-3">
      {MOCK_STRATEGIES.map((strategy) => (
        <Card key={strategy.id}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IconDna size={18} color={strategy.status === 'active' ? '#00ff88' : strategy.status === 'evolving' ? '#00d4ff' : '#6a6a8a'} />
              <div>
                <div className="text-sm font-medium text-paracosm-text">{strategy.name}</div>
                <div className="text-xs text-paracosm-muted font-mono">
                  Gen {strategy.generation} / {strategy.genes} genes
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-32">
                <Progress
                  value={strategy.fitness * 100}
                  max={100}
                  color={strategy.fitness > 0.8 ? 'green' : strategy.fitness > 0.6 ? 'cyan' : 'yellow'}
                  size="sm"
                  showLabel
                />
              </div>
              <Badge variant={statusVariant[strategy.status]}>{strategy.status}</Badge>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
