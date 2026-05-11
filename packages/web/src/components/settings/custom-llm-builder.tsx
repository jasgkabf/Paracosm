'use client';

import { useState } from 'react';
import { Card } from '@/components/common/card';
import { Input } from '@/components/common/input';
import { Button } from '@/components/common/button';
import { Badge } from '@/components/common/badge';
import { Tabs } from '@/components/common/tabs';
import { IconCustomLlm } from '@/components/icons';

interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
  status: 'draft' | 'configured' | 'testing';
}

export function CustomLlmBuilder() {
  const [providers, setProviders] = useState<CustomProvider[]>([]);
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelNames, setModelNames] = useState('');

  const addProvider = () => {
    if (!name || !baseUrl) return;
    setProviders([
      ...providers,
      {
        id: Date.now().toString(),
        name,
        baseUrl,
        models: modelNames.split(',').map((m) => m.trim()).filter(Boolean),
        status: 'draft',
      },
    ]);
    setName('');
    setBaseUrl('');
    setModelNames('');
  };

  const tabs = [
    { id: 'builder', label: 'Builder' },
    { id: 'templates', label: 'Templates' },
    { id: 'saved', label: 'Saved' },
  ];

  return (
    <Tabs tabs={tabs}>
      {(activeTab) => (
        <>
          {activeTab === 'builder' && (
            <div className="space-y-4">
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <IconCustomLlm size={18} color="#00d4ff" />
                  <span className="text-sm font-medium text-paracosm-text">Custom Provider Builder</span>
                </div>

                <div className="space-y-3">
                  <Input
                    label="Provider Name"
                    placeholder="My Custom Provider"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <Input
                    label="Base URL"
                    placeholder="https://api.example.com/v1"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                  />
                  <Input
                    label="Models (comma-separated)"
                    placeholder="model-a, model-b"
                    value={modelNames}
                    onChange={(e) => setModelNames(e.target.value)}
                  />
                  <Button onClick={addProvider} disabled={!name || !baseUrl}>
                    Create Provider
                  </Button>
                </div>
              </Card>

              {providers.length > 0 && (
                <div className="space-y-2">
                  {providers.map((p) => (
                    <Card key={p.id}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-paracosm-text">{p.name}</div>
                          <div className="text-xs text-paracosm-muted font-mono">{p.baseUrl}</div>
                          <div className="text-xs text-paracosm-muted mt-1">
                            Models: {p.models.join(', ')}
                          </div>
                        </div>
                        <Badge
                          variant={
                            p.status === 'configured'
                              ? 'success'
                              : p.status === 'testing'
                              ? 'warning'
                              : 'default'
                          }
                        >
                          {p.status}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'templates' && (
            <Card>
              <p className="text-sm text-paracosm-muted">
                Pre-built templates for common LLM providers will appear here.
              </p>
            </Card>
          )}

          {activeTab === 'saved' && (
            <Card>
              <p className="text-sm text-paracosm-muted">
                Your saved custom provider configurations will appear here.
              </p>
            </Card>
          )}
        </>
      )}
    </Tabs>
  );
}
