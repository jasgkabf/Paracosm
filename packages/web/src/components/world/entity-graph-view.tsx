'use client';

import { Card } from '@/components/common/card';
import { Badge } from '@/components/common/badge';

interface Entity {
  id: string;
  name: string;
  type: string;
  relations: number;
}

const MOCK_ENTITIES: Entity[] = [
  { id: '1', name: 'Project Alpha', type: 'goal', relations: 5 },
  { id: '2', name: 'API Integration', type: 'task', relations: 3 },
  { id: '3', name: 'User System', type: 'component', relations: 7 },
  { id: '4', name: 'Auth Module', type: 'component', relations: 4 },
  { id: '5', name: 'Data Pipeline', type: 'task', relations: 2 },
];

const typeColors: Record<string, 'success' | 'info' | 'warning'> = {
  goal: 'success',
  task: 'info',
  component: 'warning',
};

export function EntityGraphView() {
  return (
    <Card className="h-full flex flex-col">
      <div className="text-sm font-medium text-paracosm-text mb-3">Entity Graph</div>
      <div className="flex-1 overflow-y-auto space-y-2">
        {MOCK_ENTITIES.map((entity) => (
          <div
            key={entity.id}
            className="flex items-center justify-between p-2 rounded-md bg-paracosm-dark/50 border border-paracosm-border hover:border-paracosm-green/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-paracosm-green/60" />
              <span className="text-sm text-paracosm-text">{entity.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-paracosm-muted font-mono">{entity.relations} links</span>
              <Badge variant={typeColors[entity.type] ?? 'default'}>{entity.type}</Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
