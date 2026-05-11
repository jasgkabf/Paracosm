"use client";

import { useState, useCallback, useEffect } from "react";

interface Entity {
  id: string;
  name: string;
  type: string;
  properties: Record<string, unknown>;
}

interface Relation {
  id: string;
  source: string;
  target: string;
  label: string;
}

interface WorldModel {
  entities: Entity[];
  relations: Relation[];
  stats: {
    entityCount: number;
    relationCount: number;
    depth: number;
  };
}

interface UseWorldModelReturn {
  worldModel: WorldModel | null;
  isLoading: boolean;
  error: string | null;
  addEntity: (entity: Omit<Entity, "id">) => Promise<void>;
  removeEntity: (id: string) => Promise<void>;
  addRelation: (relation: Omit<Relation, "id">) => Promise<void>;
  removeRelation: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useWorldModel(): UseWorldModelReturn {
  const [worldModel, setWorldModel] = useState<WorldModel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorldModel = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/world-model");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setWorldModel(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load world model");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addEntity = useCallback(async (entity: Omit<Entity, "id">) => {
    try {
      const response = await fetch("/api/world-model/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entity),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await fetchWorldModel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add entity");
    }
  }, [fetchWorldModel]);

  const removeEntity = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/world-model/entities/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await fetchWorldModel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove entity");
    }
  }, [fetchWorldModel]);

  const addRelation = useCallback(async (relation: Omit<Relation, "id">) => {
    try {
      const response = await fetch("/api/world-model/relations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(relation),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await fetchWorldModel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add relation");
    }
  }, [fetchWorldModel]);

  const removeRelation = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/world-model/relations/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await fetchWorldModel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove relation");
    }
  }, [fetchWorldModel]);

  useEffect(() => {
    fetchWorldModel();
  }, [fetchWorldModel]);

  return {
    worldModel,
    isLoading,
    error,
    addEntity,
    removeEntity,
    addRelation,
    removeRelation,
    refresh: fetchWorldModel,
  };
}
