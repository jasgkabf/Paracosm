"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { BudgetConfig } from "@/components/settings/budget-config";

export default function BudgetSettingsPage() {
  return (
    <AppLayout>
      <div className="flex flex-col h-full p-6 gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Budget Configuration</h1>
          <p className="text-sm text-gray-400 mt-1">
            Set spending limits and track token usage across providers
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <BudgetConfig />
        </div>
      </div>
    </AppLayout>
  );
}
