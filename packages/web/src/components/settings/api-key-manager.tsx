"use client";

import { Button } from "@/components/common/button";
import { IconKey, IconEye, IconEyeOff, IconTrash, IconCheck } from "@/components/icons";
import { useState } from "react";

interface ApiKey {
  id: string;
  provider: string;
  keyPreview: string;
  createdAt: string;
  lastUsed: string;
}

const mockKeys: ApiKey[] = [
  { id: "k1", provider: "OpenAI", keyPreview: "sk-...7xYm", createdAt: "2024-01-01", lastUsed: "2024-01-15" },
  { id: "k2", provider: "Anthropic", keyPreview: "sk-ant-...9kLp", createdAt: "2024-01-02", lastUsed: "2024-01-15" },
  { id: "k3", provider: "DeepSeek", keyPreview: "dsk-...3mNq", createdAt: "2024-01-05", lastUsed: "2024-01-14" },
];

export function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKey[]>(mockKeys);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProvider, setNewProvider] = useState("");
  const [newKey, setNewKey] = useState("");
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testStatus, setTestStatus] = useState<Record<string, "idle" | "testing" | "success" | "error">>({});

  const handleAddKey = () => {
    if (!newProvider || !newKey) return;
    const key: ApiKey = {
      id: `k${Date.now()}`,
      provider: newProvider,
      keyPreview: `${newKey.slice(0, 3)}...${newKey.slice(-4)}`,
      createdAt: new Date().toISOString().split("T")[0],
      lastUsed: "Never",
    };
    setKeys((prev) => [...prev, key]);
    setNewProvider("");
    setNewKey("");
    setShowAddForm(false);
  };

  const handleDelete = (id: string) => {
    setKeys((prev) => prev.filter((k) => k.id !== id));
  };

  const handleTest = (id: string) => {
    setTestStatus((prev) => ({ ...prev, [id]: "testing" }));
    setTimeout(() => {
      setTestStatus((prev) => ({ ...prev, [id]: "success" }));
    }, 1500);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-400">API Keys</h3>
        <Button variant="primary" size="sm" onClick={() => setShowAddForm(true)}>
          <IconKey size={14} />
          <span className="ml-2">Add Key</span>
        </Button>
      </div>

      <div className="space-y-3">
        {keys.map((key) => (
          <div key={key.id} className="glass-panel p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <IconKey size={16} className="text-paracosm-yellow" />
                <div>
                  <div className="text-sm font-medium text-white">{key.provider}</div>
                  <div className="text-xs text-gray-500 font-mono">{key.keyPreview}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {testStatus[key.id] === "testing" && (
                  <span className="text-xs text-paracosm-cyan">Testing...</span>
                )}
                {testStatus[key.id] === "success" && (
                  <span className="text-xs text-paracosm-green flex items-center gap-1">
                    <IconCheck size={12} /> Valid
                  </span>
                )}
                <Button variant="ghost" size="sm" onClick={() => handleTest(key.id)}>
                  Test
                </Button>
                <Button variant="ghost" size="sm" className="text-paracosm-red" onClick={() => handleDelete(key.id)}>
                  <IconTrash size={14} />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span>Created: {key.createdAt}</span>
              <span>Last used: {key.lastUsed}</span>
            </div>
          </div>
        ))}
      </div>

      {showAddForm && (
        <div className="glass-panel p-4 space-y-3">
          <h4 className="text-sm font-medium text-white">Add API Key</h4>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Provider</label>
            <select
              value={newProvider}
              onChange={(e) => setNewProvider(e.target.value)}
              className="w-full bg-paracosm-gray border border-paracosm-gray-light/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-paracosm-green/50"
            >
              <option value="">Select provider</option>
              <option value="OpenAI">OpenAI</option>
              <option value="Anthropic">Anthropic</option>
              <option value="Google AI">Google AI</option>
              <option value="DeepSeek">DeepSeek</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">API Key</label>
            <input
              type="password"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="w-full bg-paracosm-gray border border-paracosm-gray-light/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-paracosm-green/50"
              placeholder="Enter API key"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleAddKey}>Save</Button>
          </div>
        </div>
      )}
    </div>
  );
}
