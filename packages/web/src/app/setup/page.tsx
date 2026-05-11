"use client";

import { SetupWizard } from "@/components/setup/setup-wizard";

export default function SetupPage() {
  return (
    <div className="min-h-screen bg-paracosm-dark flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Welcome to Paracosm</h1>
          <p className="text-gray-400 mt-2">
            Let&apos;s set up your agent platform. This will only take a few minutes.
          </p>
        </div>
        <SetupWizard />
      </div>
    </div>
  );
}
