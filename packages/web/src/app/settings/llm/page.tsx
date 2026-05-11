"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { ProviderConfig } from "@/components/settings/provider-config";
import { ApiKeyManager } from "@/components/settings/api-key-manager";
import { ModelSelector } from "@/components/settings/model-selector";
import { Tabs } from "@/components/common/tabs";
import { useState } from "react";

export default function LlmSettingsPage() {
  const [activeTab, setActiveTab] = useState("providers");

  const tabs = [
    { id: "providers", label: "Providers" },
    { id: "api-keys", label: "API Keys" },
    { id: "models", label: "Models" },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col h-full p-6 gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">LLM Configuration</h1>
          <p className="text-sm text-gray-400 mt-1">
            Configure language model providers, API keys, and model selection
          </p>
        </div>

        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="flex-1 min-h-0 overflow-y-auto">
          {activeTab === "providers" && <ProviderConfig />}
          {activeTab === "api-keys" && <ApiKeyManager />}
          {activeTab === "models" && <ModelSelector />}
        </div>
      </div>
    </AppLayout>
  );
}
