"use client";

import { useState, useCallback } from "react";

interface Strategy {
  id: string;
  name: string;
  type: "active" | "evolved" | "custom";
  fitness: number;
  generation: number;
  status: "running" | "paused" | "completed";
}

interface UseStrategyReturn {
  strategies: Strategy[];
  isLoading: boolean;
  error: string | null;
  createStrategy: (config: Record<string, unknown>) => Promise<void>;
  activateStrategy: (id: string) => Promise<void>;
  deactivateStrategy: (id: string) => Promise<void>;
  deleteStrategy: (id: string) => Promise<void>;
  evolveStrategy: (id: string, generations: number) => Promise<void>;
}

export function useStrategy(): UseStrategyReturn {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createStrategy = useCallback(async (config: Record<string, unknown>) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setStrategies((prev) => [...prev, data]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create strategy");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const activateStrategy = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/strategy/${id}/activate`, { method: "POST" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setStrategies((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: "running" as const } : s))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate strategy");
    }
  }, []);

  const deactivateStrategy = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/strategy/${id}/deactivate`, { method: "POST" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setStrategies((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: "paused" as const } : s))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deactivate strategy");
    }
  }, []);

  const deleteStrategy = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/strategy/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setStrategies((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete strategy");
    }
  }, []);

  const evolveStrategy = useCallback(async (id: string, generations: number) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/strategy/${id}/evolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generations }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setStrategies((prev) => prev.map((s) => (s.id === id ? data : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to evolve strategy");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    strategies,
    isLoading,
    error,
    createStrategy,
    activateStrategy,
    deactivateStrategy,
    deleteStrategy,
    evolveStrategy,
  };
}
