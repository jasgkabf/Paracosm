'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { IconTool } from '@/components/icons';

export default function ToolsPage() {
  return (
    <AppLayout>
      <div className="flex flex-col gap-6 h-full">
        <div className="flex items-center gap-3">
          <IconTool size={24} />
          <h1 className="text-2xl font-bold text-paracosm-text">Tools</h1>
        </div>
        <div className="glass-panel p-6">
          <p className="text-paracosm-muted">Tool registry and management</p>
        </div>
      </div>
    </AppLayout>
  );
}
