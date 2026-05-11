'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { ProviderConfig } from '@/components/settings/provider-config';
import { ApiKeyManager } from '@/components/settings/api-key-manager';

export default function LLMSettingsPage() {
  return (
    <AppLayout>
      <div className="flex flex-col gap-6 h-full">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-paracosm-text">LLM Configuration</h1>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto">
          <ProviderConfig />
          <ApiKeyManager />
        </div>
      </div>
    </AppLayout>
  );
}
