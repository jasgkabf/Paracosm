"use client";

import { useState, useCallback, useEffect } from "react";

interface Tool {
  id: string;
  name: string;
  description: string;
  type: "builtin" | "plugin" | "mcp";
  status: "active" | "inactive" | "error";
  parameters: Array<{ name: string; type: string; required: boolean }>;
}

interface UseToolsReturn {
  tools: Tool[];
  isLoading: boolean;
  error: string | null;
  installPlugin: (pluginId: string) => Promise<void>;
  uninstallPlugin: (pluginId: string) => Promise<void>;
  toggleTool: (toolId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useTools(): UseToolsReturn {
  const [tools, setTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTools = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/tools");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setTools(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tools");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const installPlugin = useCallback(async (pluginId: string) => {
    try {
      const response = await fetch(`/api/tools/plugins/${pluginId}/install`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await fetchTools();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to install plugin");
    }
  }, [fetchTools]);

  const uninstallPlugin = useCallback(async (pluginId: string) => {
    try {
      const response = await fetch(`/api/tools/plugins/${pluginId}/uninstall`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await fetchTools();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to uninstall plugin");
    }
  }, [fetchTools]);

  const toggleTool = useCallback(async (toolId: string) => {
    try {
      const response = await fetch(`/api/tools/${toolId}/toggle`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await fetchTools();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle tool");
    }
  }, [fetchTools]);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  return {
    tools,
    isLoading,
    error,
    installPlugin,
    uninstallPlugin,
    toggleTool,
    refresh: fetchTools,
  };
}
