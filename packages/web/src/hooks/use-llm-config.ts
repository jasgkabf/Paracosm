'use client';

import { useState, useCallback } from 'react';
import type { LLMConfig, ProviderConfig } from '@paracosm/shared';

export function useLlmConfig() {
  const [config, setConfig] = useState<Partial<LLMConfig> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/llm-config');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch config');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (updates: Partial<LLMConfig>) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/llm-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update config');
    } finally {
      setLoading(false);
    }
  }, []);

  const addProvider = useCallback(async (provider: ProviderConfig) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/llm-config/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(provider),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add provider');
    } finally {
      setLoading(false);
    }
  }, [fetchConfig]);

  return { config, loading, error, fetchConfig, updateConfig, addProvider };
}
