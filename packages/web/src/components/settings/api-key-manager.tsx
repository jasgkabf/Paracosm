'use client';

import { useState } from 'react';
import { Card } from '@/components/common/card';
import { Input } from '@/components/common/input';
import { Button } from '@/components/common/button';
import { Badge } from '@/components/common/badge';
import { IconKey, IconX } from '@/components/icons';

interface ApiKeyEntry {
  id: string;
  provider: string;
  keyPreview: string;
  addedAt: string;
}

export function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKeyEntry[]>([
    { id: '1', provider: 'openai', keyPreview: 'sk-...3xKp', addedAt: '2024-01-15' },
    { id: '2', provider: 'anthropic', keyPreview: 'sk-ant-...7mNq', addedAt: '2024-01-15' },
  ]);
  const [newProvider, setNewProvider] = useState('');
  const [newKey, setNewKey] = useState('');

  const addKey = () => {
    if (!newProvider || !newKey) return;
    setKeys([
      ...keys,
      {
        id: Date.now().toString(),
        provider: newProvider,
        keyPreview: `${newKey.slice(0, 4)}...${newKey.slice(-4)}`,
        addedAt: new Date().toISOString().split('T')[0],
      },
    ]);
    setNewProvider('');
    setNewKey('');
  };

  const removeKey = (id: string) => {
    setKeys(keys.filter((k) => k.id !== id));
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <IconKey size={18} />
        <span className="text-sm font-medium text-paracosm-text">API Keys</span>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between p-3 rounded-md bg-paracosm-dark/50 border border-paracosm-border"
            >
              <div className="flex items-center gap-3">
                <Badge variant="info">{key.provider}</Badge>
                <span className="text-sm text-paracosm-muted font-mono">{key.keyPreview}</span>
                <span className="text-xs text-paracosm-muted/60">{key.addedAt}</span>
              </div>
              <button
                onClick={() => removeKey(key.id)}
                className="text-paracosm-muted hover:text-red-400 transition-colors"
              >
                <IconX size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Provider name"
            value={newProvider}
            onChange={(e) => setNewProvider(e.target.value)}
            className="flex-1"
          />
          <Input
            type="password"
            placeholder="API key"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="flex-1"
          />
          <Button size="sm" onClick={addKey}>
            Add
          </Button>
        </div>
      </div>
    </Card>
  );
}
