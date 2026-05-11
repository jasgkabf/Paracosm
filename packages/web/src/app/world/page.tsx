'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { EntityGraphView } from '@/components/world/entity-graph-view';
import { TimelineView } from '@/components/world/timeline-view';

export default function WorldPage() {
  return (
    <AppLayout>
      <div className="flex flex-col gap-6 h-full">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-paracosm-text">World Model</h1>
        </div>
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
          <EntityGraphView />
          <TimelineView />
        </div>
      </div>
    </AppLayout>
  );
}
