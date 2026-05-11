'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { IconSettings } from '@/components/icons';

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="flex flex-col gap-6 h-full">
        <div className="flex items-center gap-3">
          <IconSettings size={24} />
          <h1 className="text-2xl font-bold text-paracosm-text">Settings</h1>
        </div>
        <div className="glass-panel p-6">
          <div className="space-y-4">
            <a
              href="/settings/llm"
              className="block p-4 rounded-lg border border-paracosm-border hover:border-paracosm-green/30 hover:bg-paracosm-green/5 transition-colors"
            >
              <h3 className="text-paracosm-text font-medium">LLM Configuration</h3>
              <p className="text-paracosm-muted text-sm mt-1">
                Configure LLM providers, API keys, and routing
              </p>
            </a>
            <a
              href="/settings/custom-llm"
              className="block p-4 rounded-lg border border-paracosm-border hover:border-paracosm-cyan/30 hover:bg-paracosm-cyan/5 transition-colors"
            >
              <h3 className="text-paracosm-text font-medium">Custom LLM Builder</h3>
              <p className="text-paracosm-muted text-sm mt-1">
                Create and manage custom LLM provider configurations
              </p>
            </a>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
