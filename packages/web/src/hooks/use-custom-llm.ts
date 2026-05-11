'use client';

import { useState, useCallback } from 'react';
import type { CustomProviderConfig } from '@paracosm/shared';

export function useCustomLlm() {
  const [providers, setProviders] = useState<CustomProviderConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/custom-llm');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProviders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch providers');
    } finally {
      setLoading(false);
    }
  }, []);

  const createProvider = useCallback(async (provider: Partial<CustomProviderConfig>) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/custom-llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(provider),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create provider');
    } finally {
      setLoading(false);
    }
  }, [fetchProviders]);

  const deleteProvider = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/custom-llm/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete provider');
    } finally {
      setLoading(false);
    }
  }, [fetchProviders]);

  return { providers, loading, error, fetchProviders, createProvider, deleteProvider };
}
