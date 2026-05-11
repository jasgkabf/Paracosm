"use client";

import { useState, useCallback } from "react";

interface Simulation {
  id: string;
  name: string;
  status: "running" | "completed" | "failed" | "pending";
  paths: number;
  bestScore: number;
}

interface SimulationResult {
  paths: Array<{
    id: string;
    name: string;
    score: number;
    risk: number;
  }>;
  metrics: {
    totalPaths: number;
    iterations: number;
    bestScore: number;
    avgScore: number;
  };
}

interface UseSimulationReturn {
  simulations: Simulation[];
  currentSimulation: SimulationResult | null;
  isLoading: boolean;
  error: string | null;
  startSimulation: (config: Record<string, unknown>) => Promise<string>;
  getSimulationResult: (id: string) => Promise<void>;
  cancelSimulation: (id: string) => Promise<void>;
}

export function useSimulation(): UseSimulationReturn {
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [currentSimulation, setCurrentSimulation] = useState<SimulationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSimulation = useCallback(async (config: Record<string, unknown>) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setSimulations((prev) => [...prev, data]);
      return data.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start simulation");
      return "";
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getSimulationResult = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/simulation/${id}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setCurrentSimulation(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get simulation result");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const cancelSimulation = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/simulation/${id}/cancel`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setSimulations((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: "failed" as const } : s))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel simulation");
    }
  }, []);

  return {
    simulations,
    currentSimulation,
    isLoading,
    error,
    startSimulation,
    getSimulationResult,
    cancelSimulation,
  };
}
