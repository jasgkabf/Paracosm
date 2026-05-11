'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { StrategyList } from '@/components/strategy/strategy-list';

export default function StrategiesPage() {
  return (
    <AppLayout>
      <div className="flex flex-col gap-6 h-full">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-paracosm-text">Strategies</h1>
        </div>
        <div className="flex-1 min-h-0">
          <StrategyList />
        </div>
      </div>
    </AppLayout>
  );
}
