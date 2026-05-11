'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { HeartbeatPanel } from '@/components/heartbeat/heartbeat-panel';

export default function HeartbeatPage() {
  return (
    <AppLayout>
      <HeartbeatPanel />
    </AppLayout>
  );
}
