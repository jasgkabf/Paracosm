"use client";

import { Badge } from "@/components/common/badge";
import { useState } from "react";

interface Model {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  costPerToken: number;
  capabilities: string[];
  enabled: boolean;
}

const mockModels: Model[] = [
  { id: "gpt-4", name: "GPT-4", provider: "OpenAI", contextWindow: 128000, costPerToken: 0.00003, capabilities: ["chat", "code", "analysis"], enabled: true },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "OpenAI", contextWindow: 128000, costPerToken: 0.00001, capabilities: ["chat", "code", "analysis"], enabled: true },
  { id: "claude-3-opus", name: "Claude 3 Opus", provider: "Anthropic", contextWindow: 200000, costPerToken: 0.000015, capabilities: ["chat", "code", "analysis", "vision"], enabled: true },
  { id: "claude-3-sonnet", name: "Claude 3 Sonnet", provider: "Anthropic", contextWindow: 200000, costPerToken: 0.000003, capabilities: ["chat", "code", "analysis"], enabled: true },
  { id: "gemini-pro", name: "Gemini Pro", provider: "Google", contextWindow: 32000, costPerToken: 0.000001, capabilities: ["chat", "code"], enabled: false },
  { id: "llama3", name: "Llama 3", provider: "Ollama", contextWindow: 8000, costPerToken: 0, capabilities: ["chat", "code"], enabled: true },
];

export function ModelSelector() {
  const [models, setModels] = useState<Model[]>(mockModels);
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all"
    ? models
    : models.filter((m) => m.provider.toLowerCase() === filter);

  const toggleModel = (id: string) => {
    setModels((prev) =>
      prev.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m))
    );
  };

  const formatContext = (tokens: number) => {
    if (tokens >= 1000) return `${tokens / 1000}K`;
    return tokens.toString();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {["all", "openai", "anthropic", "google", "ollama"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
              filter === f
                ? "bg-paracosm-green/20 text-paracosm-green"
                : "text-gray-400 hover:text-white hover:bg-paracosm-gray-light/30"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((model) => (
          <div
            key={model.id}
            className={`glass-panel p-4 transition-colors ${
              model.enabled ? "" : "opacity-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-white">{model.name}</h3>
                  <Badge size="sm">{model.provider}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>Context: {formatContext(model.contextWindow)}</span>
                  <span>Cost: ${model.costPerToken.toFixed(6)}/token</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {model.capabilities.map((cap) => (
                    <Badge key={cap} size="sm" variant="info">{cap}</Badge>
                  ))}
                </div>
              </div>
              <button
                onClick={() => toggleModel(model.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  model.enabled
                    ? "bg-paracosm-green/20 text-paracosm-green"
                    : "bg-gray-700 text-gray-400"
                }`}
              >
                {model.enabled ? "Enabled" : "Disabled"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
