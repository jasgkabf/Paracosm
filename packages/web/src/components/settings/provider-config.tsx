"use client";

import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/button";
import { Switch } from "@/components/common/switch";
import { IconSettings } from "@/components/icons";
import { useState } from "react";

interface Provider {
  id: string;
  name: string;
  enabled: boolean;
  models: string[];
  defaultModel: string;
  apiKeySet: boolean;
}

const mockProviders: Provider[] = [
  { id: "openai", name: "OpenAI", enabled: true, models: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"], defaultModel: "gpt-4", apiKeySet: true },
  { id: "anthropic", name: "Anthropic", enabled: true, models: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"], defaultModel: "claude-3-sonnet", apiKeySet: true },
  { id: "google", name: "Google AI", enabled: false, models: ["gemini-pro", "gemini-ultra"], defaultModel: "gemini-pro", apiKeySet: false },
  { id: "deepseek", name: "DeepSeek", enabled: true, models: ["deepseek-chat", "deepseek-coder"], defaultModel: "deepseek-chat", apiKeySet: true },
  { id: "ollama", name: "Ollama (Local)", enabled: true, models: ["llama3", "mistral", "codellama"], defaultModel: "llama3", apiKeySet: false },
];

export function ProviderConfig() {
  const [providers, setProviders] = useState<Provider[]>(mockProviders);

  const toggleProvider = (id: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const setDefaultModel = (id: string, model: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, defaultModel: model } : p))
    );
  };

  return (
    <div className="space-y-4">
      {providers.map((provider) => (
        <div key={provider.id} className="glass-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <IconSettings size={18} className="text-gray-400" />
              <div>
                <h3 className="text-sm font-medium text-white">{provider.name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  {provider.apiKeySet ? (
                    <Badge size="sm" className="text-paracosm-green">API Key Set</Badge>
                  ) : (
                    <Badge size="sm" className="text-paracosm-yellow">No API Key</Badge>
                  )}
                  <Badge size="sm">{provider.models.length} models</Badge>
                </div>
              </div>
            </div>
            <Switch checked={provider.enabled} onChange={() => toggleProvider(provider.id)} />
          </div>

          {provider.enabled && (
            <div className="ml-9">
              <label className="block text-xs text-gray-500 mb-1">Default Model</label>
              <select
                value={provider.defaultModel}
                onChange={(e) => setDefaultModel(provider.id, e.target.value)}
                className="w-full bg-paracosm-gray border border-paracosm-gray-light/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-paracosm-green/50"
              >
                {provider.models.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
