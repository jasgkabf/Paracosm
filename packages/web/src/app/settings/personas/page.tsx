"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { PersonaConfig } from "@/components/settings/persona-config";

export default function PersonasSettingsPage() {
  return (
    <AppLayout>
      <div className="flex flex-col h-full p-6 gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Persona Configuration</h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage agent personas and their behavioral configurations
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <PersonaConfig />
        </div>
      </div>
    </AppLayout>
  );
}
