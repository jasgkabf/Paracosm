'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { SimulationPanel } from '@/components/simulation/simulation-panel';

export default function SimulatePage() {
  return (
    <AppLayout>
      <div className="flex flex-col gap-6 h-full">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-paracosm-text">Simulation</h1>
        </div>
        <div className="flex-1 min-h-0">
          <SimulationPanel />
        </div>
      </div>
    </AppLayout>
  );
}
