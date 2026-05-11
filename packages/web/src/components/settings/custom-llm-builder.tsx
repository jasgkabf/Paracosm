"use client";

import { Button } from "@/components/common/button";
import { Badge } from "@/components/common/badge";
import { IconCustomLlm, IconTest } from "@/components/icons";
import { useState } from "react";

interface CustomLlmBuilderProps {
  onClose: () => void;
  onSave: (provider: { id: string; name: string; endpoint: string; status: string }) => void;
}

export function CustomLlmBuilder({ onClose, onSave }: CustomLlmBuilderProps) {
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelPath, setModelPath] = useState("");
  const [transportType, setTransportType] = useState("openai");
  const [maxTokens, setMaxTokens] = useState(4096);
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(1.0);
  const [streamSupport, setStreamSupport] = useState(true);
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; value: string }>>([]);
  const [testResult, setTestResult] = useState<"idle" | "testing" | "success" | "error">("idle");

  const addHeader = () => {
    setCustomHeaders((prev) => [...prev, { key: "", value: "" }]);
  };

  const removeHeader = (index: number) => {
    setCustomHeaders((prev) => prev.filter((_, i) => i !== index));
  };

  const updateHeader = (index: number, field: "key" | "value", value: string) => {
    setCustomHeaders((prev) =>
      prev.map((h, i) => (i === index ? { ...h, [field]: value } : h))
    );
  };

  const handleTest = () => {
    setTestResult("testing");
    setTimeout(() => {
      setTestResult(endpoint ? "success" : "error");
    }, 2000);
  };

  const handleSave = () => {
    onSave({
      id: `custom-${Date.now()}`,
      name: name || "Custom Provider",
      endpoint: endpoint,
      status: testResult === "success" ? "connected" : "disconnected",
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="glass-panel p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <IconCustomLlm size={24} className="text-paracosm-cyan" />
            <h2 className="text-lg font-semibold text-white">Custom LLM Provider</h2>
          </div>
          <Badge size="sm">OpenAI-Compatible</Badge>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Provider Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-paracosm-gray border border-paracosm-gray-light/30 rounded-md px-3 py-2 text-white focus:outline-none focus:border-paracosm-green/50"
                placeholder="My Custom LLM"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Transport Type</label>
              <select
                value={transportType}
                onChange={(e) => setTransportType(e.target.value)}
                className="w-full bg-paracosm-gray border border-paracosm-gray-light/30 rounded-md px-3 py-2 text-white focus:outline-none focus:border-paracosm-green/50"
              >
                <option value="openai">OpenAI Compatible</option>
                <option value="ollama">Ollama</option>
                <option value="vllm">vLLM</option>
                <option value="lmstudio">LM Studio</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Endpoint URL</label>
            <input
              type="url"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="w-full bg-paracosm-gray border border-paracosm-gray-light/30 rounded-md px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-paracosm-green/50"
              placeholder="http://localhost:11434/v1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">API Key (optional)</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-paracosm-gray border border-paracosm-gray-light/30 rounded-md px-3 py-2 text-white focus:outline-none focus:border-paracosm-green/50"
                placeholder="sk-..."
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Model Path</label>
              <input
                type="text"
                value={modelPath}
                onChange={(e) => setModelPath(e.target.value)}
                className="w-full bg-paracosm-gray border border-paracosm-gray-light/30 rounded-md px-3 py-2 text-white focus:outline-none focus:border-paracosm-green/50"
                placeholder="llama3"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Max Tokens</label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                className="w-full bg-paracosm-gray border border-paracosm-gray-light/30 rounded-md px-3 py-2 text-white font-mono focus:outline-none focus:border-paracosm-green/50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Temperature</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-full bg-paracosm-gray border border-paracosm-gray-light/30 rounded-md px-3 py-2 text-white font-mono focus:outline-none focus:border-paracosm-green/50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Top P</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={topP}
                onChange={(e) => setTopP(Number(e.target.value))}
                className="w-full bg-paracosm-gray border border-paracosm-gray-light/30 rounded-md px-3 py-2 text-white font-mono focus:outline-none focus:border-paracosm-green/50"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-400">Stream Support</label>
            <button
              onClick={() => setStreamSupport(!streamSupport)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                streamSupport ? "bg-paracosm-green/20 text-paracosm-green" : "bg-gray-700 text-gray-400"
              }`}
            >
              {streamSupport ? "Enabled" : "Disabled"}
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-400">Custom Headers</label>
              <Button variant="ghost" size="sm" onClick={addHeader}>+ Add Header</Button>
            </div>
            {customHeaders.map((header, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={header.key}
                  onChange={(e) => updateHeader(i, "key", e.target.value)}
                  className="flex-1 bg-paracosm-gray border border-paracosm-gray-light/30 rounded-md px-3 py-1.5 text-white text-sm focus:outline-none focus:border-paracosm-green/50"
                  placeholder="Header name"
                />
                <input
                  type="text"
                  value={header.value}
                  onChange={(e) => updateHeader(i, "value", e.target.value)}
                  className="flex-1 bg-paracosm-gray border border-paracosm-gray-light/30 rounded-md px-3 py-1.5 text-white text-sm focus:outline-none focus:border-paracosm-green/50"
                  placeholder="Header value"
                />
                <Button variant="ghost" size="sm" className="text-paracosm-red" onClick={() => removeHeader(i)}>
                  X
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-paracosm-gray-light/10">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleTest} disabled={!endpoint}>
              <IconTest size={14} />
              <span className="ml-2">Test Connection</span>
            </Button>
            {testResult === "testing" && <span className="text-xs text-paracosm-cyan">Testing...</span>}
            {testResult === "success" && <span className="text-xs text-paracosm-green">Connected</span>}
            {testResult === "error" && <span className="text-xs text-paracosm-red">Connection failed</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleSave}>Save Provider</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
