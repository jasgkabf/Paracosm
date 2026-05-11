'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { CustomLlmBuilder } from '@/components/settings/custom-llm-builder';

export default function CustomLlmPage() {
  return (
    <AppLayout>
      <div className="flex flex-col gap-6 h-full">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-paracosm-text">Custom LLM Builder</h1>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <CustomLlmBuilder />
        </div>
      </div>
    </AppLayout>
  );
}
