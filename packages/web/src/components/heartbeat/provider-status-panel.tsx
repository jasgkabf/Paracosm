'use client';

import type { ProviderStatus } from '@paracosm/shared';
import { Badge } from '@/components/common/badge';

interface ProviderStatusPanelProps {
  providers: ProviderStatus[];
}

export function ProviderStatusPanel({ providers }: ProviderStatusPanelProps) {
  if (providers.length === 0) {
    return (
      <div className="glass-panel p-4 space-y-4">
        <div className="text-xs font-mono text-paracosm-muted uppercase tracking-wider">
          LLM Providers
        </div>
        <div className="text-sm text-paracosm-muted">No providers configured</div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-4 space-y-4">
      <div className="text-xs font-mono text-paracosm-muted uppercase tracking-wider">
        LLM Providers
      </div>

      <div className="space-y-3">
        {providers.map((provider) => (
          <div key={provider.provider} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono text-paracosm-text capitalize">
                {provider.provider}
              </span>
              <Badge variant={provider.available ? 'success' : 'danger'}>
                {provider.available ? 'Online' : 'Offline'}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-paracosm-muted font-mono">
                {provider.latencyMs.toFixed(0)}ms
              </span>
              <span className="text-paracosm-muted font-mono">
                {((1 - provider.errorRate) * 100).toFixed(1)}% success
              </span>
            </div>
            <div className="w-full bg-paracosm-gray rounded-full h-1 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  provider.available ? 'bg-paracosm-green' : 'bg-red-500'
                }`}
                style={{
                  width: `${Math.min(100, (provider.quotaRemaining / Math.max(provider.quotaTotal, 1)) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
