'use client';

import { useState } from 'react';
import { Card } from '@/components/common/card';
import { Input } from '@/components/common/input';
import { Select } from '@/components/common/select';
import { Button } from '@/components/common/button';
import { Badge } from '@/components/common/badge';
import type { LLMProvider } from '@paracosm/shared';

interface ProviderEntry {
  id: string;
  provider: LLMProvider;
  model: string;
  available: boolean;
  latencyMs: number;
}

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'cohere', label: 'Cohere' },
  { value: 'local', label: 'Local' },
  { value: 'custom', label: 'Custom' },
];

export function ProviderConfig() {
  const [providers, setProviders] = useState<ProviderEntry[]>([
    { id: '1', provider: 'openai', model: 'gpt-4o', available: true, latencyMs: 340 },
    { id: '2', provider: 'anthropic', model: 'claude-3-opus', available: true, latencyMs: 420 },
  ]);
  const [defaultProvider, setDefaultProvider] = useState('openai');

  return (
    <Card>
      <div className="text-sm font-medium text-paracosm-text mb-4">Provider Configuration</div>

      <div className="space-y-4">
        <Select
          label="Default Provider"
          options={PROVIDER_OPTIONS}
          value={defaultProvider}
          onChange={(e) => setDefaultProvider(e.target.value)}
        />

        <div className="space-y-2">
          <div className="text-xs text-paracosm-muted font-mono uppercase">Configured Providers</div>
          {providers.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between p-3 rounded-md bg-paracosm-dark/50 border border-paracosm-border"
            >
              <div className="flex items-center gap-3">
                <Badge variant={p.available ? 'success' : 'danger'}>
                  {p.available ? 'Online' : 'Offline'}
                </Badge>
                <span className="text-sm text-paracosm-text capitalize">{p.provider}</span>
                <span className="text-xs text-paracosm-muted font-mono">{p.model}</span>
              </div>
              <span className="text-xs text-paracosm-muted font-mono">{p.latencyMs}ms</span>
            </div>
          ))}
        </div>

        <Button variant="secondary" size="sm">
          Add Provider
        </Button>
      </div>
    </Card>
  );
}
