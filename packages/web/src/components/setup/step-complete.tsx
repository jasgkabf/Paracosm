"use client";

import { IconCheck } from "@/components/icons";

interface StepCompleteProps {
  config: {
    provider: string;
    apiKey: string;
    model: string;
    routing: string;
  };
}

export function StepComplete({ config }: StepCompleteProps) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-paracosm-green/20 flex items-center justify-center">
        <IconCheck size={32} className="text-paracosm-green" />
      </div>
      <h2 className="text-lg font-semibold text-white mb-2">Setup Complete</h2>
      <p className="text-sm text-gray-400 mb-6">
        Your Paracosm agent is ready to use. Here is a summary of your configuration:
      </p>
      <div className="glass-panel p-4 text-left space-y-2 max-w-sm mx-auto">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Provider</span>
          <span className="text-white capitalize">{config.provider}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Model</span>
          <span className="text-white font-mono">{config.model || "default"}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Routing</span>
          <span className="text-white capitalize">{config.routing.replace("-", " ")}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">API Key</span>
          <span className="text-white">{config.apiKey ? "Configured" : "Not set"}</span>
        </div>
      </div>
    </div>
  );
}
