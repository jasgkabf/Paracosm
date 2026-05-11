"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { RoutingConfig } from "@/components/settings/routing-config";
import { FallbackChain } from "@/components/settings/fallback-chain";

export default function RoutingSettingsPage() {
  return (
    <AppLayout>
      <div className="flex flex-col h-full p-6 gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Routing Configuration</h1>
          <p className="text-sm text-gray-400 mt-1">
            Configure model routing rules and fallback chains
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
          <RoutingConfig />
          <FallbackChain />
        </div>
      </div>
    </AppLayout>
  );
}
