'use client';

import { Card } from '@/components/common/card';
import { Badge } from '@/components/common/badge';

interface TimelineEvent {
  id: string;
  name: string;
  timestamp: string;
  type: 'construct' | 'simulate' | 'execute' | 'reflect' | 'evolve';
  status: 'completed' | 'active' | 'pending';
}

const MOCK_EVENTS: TimelineEvent[] = [
  { id: '1', name: 'Initialize world model', timestamp: '10:00:00', type: 'construct', status: 'completed' },
  { id: '2', name: 'Run simulation batch', timestamp: '10:05:12', type: 'simulate', status: 'completed' },
  { id: '3', name: 'Execute plan step 3', timestamp: '10:12:30', type: 'execute', status: 'active' },
  { id: '4', name: 'Reflect on results', timestamp: '--:--:--', type: 'reflect', status: 'pending' },
  { id: '5', name: 'Evolve strategy', timestamp: '--:--:--', type: 'evolve', status: 'pending' },
];

const typeVariant: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  construct: 'success',
  simulate: 'info',
  execute: 'warning',
  reflect: 'default',
  evolve: 'info',
};

const statusDot: Record<string, string> = {
  completed: 'bg-paracosm-green',
  active: 'bg-yellow-400 animate-pulse',
  pending: 'bg-paracosm-muted/40',
};

export function TimelineView() {
  return (
    <Card className="h-full flex flex-col">
      <div className="text-sm font-medium text-paracosm-text mb-3">Timeline</div>
      <div className="flex-1 overflow-y-auto">
        <div className="relative pl-6">
          <div className="absolute left-2 top-0 bottom-0 w-px bg-paracosm-border" />
          {MOCK_EVENTS.map((event, i) => (
            <div key={event.id} className="relative pb-4 last:pb-0">
              <div
                className={`absolute left-[-6px] top-1 w-3 h-3 rounded-full border-2 border-paracosm-dark ${statusDot[event.status]}`}
              />
              <div className="ml-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-paracosm-text">{event.name}</span>
                  <Badge variant={typeVariant[event.type]}>{event.type}</Badge>
                </div>
                <span className="text-xs text-paracosm-muted font-mono">{event.timestamp}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
