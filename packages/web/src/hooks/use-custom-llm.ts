"use client";

import { useState, useCallback } from "react";

interface CustomLlmProvider {
  id: string;
  name: string;
  endpoint: string;
  transportType: string;
  modelPath: string;
  maxTokens: number;
  temperature: number;
  streamSupport: boolean;
  status: "connected" | "disconnected" | "error";
}

interface UseCustomLlmReturn {
  providers: CustomLlmProvider[];
  isLoading: boolean;
  error: string | null;
  addProvider: (provider: Omit<CustomLlmProvider, "id" | "status">) => Promise<void>;
  updateProvider: (id: string, updates: Partial<CustomLlmProvider>) => Promise<void>;
  removeProvider: (id: string) => Promise<void>;
  testConnection: (id: string) => Promise<boolean>;
}

export function useCustomLlm(): UseCustomLlmReturn {
  const [providers, setProviders] = useState<CustomLlmProvider[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addProvider = useCallback(async (provider: Omit<CustomLlmProvider, "id" | "status">) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/custom-llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(provider),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setProviders((prev) => [...prev, data]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add provider");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateProvider = useCallback(async (id: string, updates: Partial<CustomLlmProvider>) => {
    try {
      const response = await fetch(`/api/custom-llm/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setProviders((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update provider");
    }
  }, []);

  const removeProvider = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/custom-llm/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setProviders((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove provider");
    }
  }, []);

  const testConnection = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/custom-llm/${id}/test`, { method: "POST" });
      if (!response.ok) {
        setProviders((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: "error" as const } : p))
        );
        return false;
      }
      setProviders((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "connected" as const } : p))
      );
      return true;
    } catch {
      setProviders((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "error" as const } : p))
      );
      return false;
    }
  }, []);

  return {
    providers,
    isLoading,
    error,
    addProvider,
    updateProvider,
    removeProvider,
    testConnection,
  };
}
