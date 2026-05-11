"use client";

import { useState, useCallback, useEffect } from "react";

interface LlmProvider {
  id: string;
  name: string;
  enabled: boolean;
  models: string[];
  defaultModel: string;
  apiKeySet: boolean;
}

interface LlmConfig {
  providers: LlmProvider[];
  defaultProvider: string;
  defaultModel: string;
  routingStrategy: string;
  fallbackChain: string[];
}

interface UseLlmConfigReturn {
  config: LlmConfig | null;
  isLoading: boolean;
  error: string | null;
  updateProvider: (id: string, updates: Partial<LlmProvider>) => Promise<void>;
  setApiKey: (providerId: string, key: string) => Promise<void>;
  setDefaultModel: (providerId: string, model: string) => Promise<void>;
  setRoutingStrategy: (strategy: string) => Promise<void>;
  setFallbackChain: (chain: string[]) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useLlmConfig(): UseLlmConfigReturn {
  const [config, setConfig] = useState<LlmConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/llm-config");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load LLM config");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateProvider = useCallback(async (id: string, updates: Partial<LlmProvider>) => {
    try {
      const response = await fetch(`/api/llm-config/providers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update provider");
    }
  }, [fetchConfig]);

  const setApiKey = useCallback(async (providerId: string, key: string) => {
    try {
      const response = await fetch(`/api/llm-config/providers/${providerId}/api-key`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set API key");
    }
  }, [fetchConfig]);

  const setDefaultModel = useCallback(async (providerId: string, model: string) => {
    try {
      const response = await fetch(`/api/llm-config/providers/${providerId}/default-model`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set default model");
    }
  }, [fetchConfig]);

  const setRoutingStrategy = useCallback(async (strategy: string) => {
    try {
      const response = await fetch("/api/llm-config/routing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set routing strategy");
    }
  }, [fetchConfig]);

  const setFallbackChain = useCallback(async (chain: string[]) => {
    try {
      const response = await fetch("/api/llm-config/fallback-chain", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set fallback chain");
    }
  }, [fetchConfig]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return {
    config,
    isLoading,
    error,
    updateProvider,
    setApiKey,
    setDefaultModel,
    setRoutingStrategy,
    setFallbackChain,
    refresh: fetchConfig,
  };
}
