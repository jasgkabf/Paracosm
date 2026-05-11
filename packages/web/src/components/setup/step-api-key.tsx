"use client";

import { useState } from "react";

interface StepApiKeyProps {
  provider: string;
  value: string;
  onChange: (key: string) => void;
}

export function StepApiKey({ provider, value, onChange }: StepApiKeyProps) {
  const [showKey, setShowKey] = useState(false);

  const providerNames: Record<string, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google AI",
    deepseek: "DeepSeek",
  };

  const isLocal = provider === "ollama";
  const isCustom = provider === "custom";

  if (isLocal) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-white mb-2">Local Setup</h2>
        <p className="text-sm text-gray-400 mb-4">
          Ollama runs locally and does not require an API key. Make sure Ollama is running on your machine.
        </p>
        <div className="glass-panel p-4">
          <div className="flex items-center gap-2">
            <div className="status-dot status-dot-online" />
            <span className="text-sm text-paracosm-green">Ollama detected on localhost:11434</span>
          </div>
        </div>
      </div>
    );
  }

  if (isCustom) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-white mb-2">Custom Provider</h2>
        <p className="text-sm text-gray-400 mb-4">
          Enter the endpoint URL for your OpenAI-compatible provider.
        </p>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Endpoint URL</label>
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-paracosm-gray border border-paracosm-gray-light/30 rounded-md px-3 py-2 text-white font-mono focus:outline-none focus:border-paracosm-green/50"
            placeholder="http://localhost:8000/v1"
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-2">
        {providerNames[provider] || "Provider"} API Key
      </h2>
      <p className="text-sm text-gray-400 mb-4">
        Enter your API key. It will be stored securely and encrypted.
      </p>
      <div>
        <label className="block text-sm text-gray-400 mb-1">API Key</label>
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-paracosm-gray border border-paracosm-gray-light/30 rounded-md px-3 py-2 text-white font-mono focus:outline-none focus:border-paracosm-green/50 pr-20"
            placeholder="Enter your API key"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-gray-400 hover:text-white transition-colors"
          >
            {showKey ? "Hide" : "Show"}
          </button>
        </div>
      </div>
    </div>
  );
}
