"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { CustomLlmBuilder } from "@/components/settings/custom-llm-builder";
import { Button } from "@/components/common/button";
import { IconPlus } from "@/components/icons";
import { useState } from "react";

export default function CustomLlmPage() {
  const [showBuilder, setShowBuilder] = useState(false);
  const [customProviders, setCustomProviders] = useState([
    { id: "local-llama", name: "Local Llama", endpoint: "http://localhost:11434", status: "connected" },
    { id: "vllm-server", name: "vLLM Server", endpoint: "http://localhost:8000", status: "disconnected" },
  ]);

  const handleDelete = (id: string) => {
    setCustomProviders((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full p-6 gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Custom LLM Providers</h1>
            <p className="text-sm text-gray-400 mt-1">
              Add and configure custom OpenAI-compatible LLM endpoints
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowBuilder(true)}>
            <IconPlus size={16} />
            <span className="ml-2">Add Provider</span>
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
          {customProviders.map((provider) => (
            <div key={provider.id} className="glass-panel p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`status-dot ${
                      provider.status === "connected" ? "status-dot-online" : "status-dot-offline"
                    }`}
                  />
                  <div>
                    <h3 className="text-white font-medium">{provider.name}</h3>
                    <p className="text-sm text-gray-400 font-mono">{provider.endpoint}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm">
                    Test
                  </Button>
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-paracosm-red"
                    onClick={() => handleDelete(provider.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {customProviders.length === 0 && (
            <div className="glass-panel p-8 text-center text-gray-500">
              <p>No custom LLM providers configured</p>
              <p className="text-sm mt-2">Add a provider to connect to custom OpenAI-compatible endpoints</p>
            </div>
          )}
        </div>

        {showBuilder && (
          <CustomLlmBuilder
            onClose={() => setShowBuilder(false)}
            onSave={(provider) => {
              setCustomProviders((prev) => [...prev, provider]);
              setShowBuilder(false);
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}
