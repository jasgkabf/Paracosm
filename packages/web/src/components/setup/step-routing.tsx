"use client";

interface StepRoutingProps {
  value: string;
  onChange: (routing: string) => void;
}

const routingOptions = [
  {
    id: "smart",
    title: "Smart Routing",
    description: "Automatically select the best model based on task type, cost, and latency",
  },
  {
    id: "manual",
    title: "Manual Routing",
    description: "Always use the default model unless explicitly specified",
  },
  {
    id: "cost-optimized",
    title: "Cost Optimized",
    description: "Prefer cheaper models when possible to minimize spending",
  },
  {
    id: "performance",
    title: "Performance First",
    description: "Always use the most capable model for best results",
  },
];

export function StepRouting({ value, onChange }: StepRoutingProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-2">Routing Strategy</h2>
      <p className="text-sm text-gray-400 mb-6">
        Choose how the agent selects models for different tasks.
      </p>
      <div className="space-y-3">
        {routingOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            className={`w-full p-4 rounded-lg border text-left transition-colors ${
              value === option.id
                ? "border-paracosm-green/50 bg-paracosm-green/5"
                : "border-paracosm-gray-light/20 hover:border-paracosm-gray-light/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-white">{option.title}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{option.description}</p>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 ${
                value === option.id
                  ? "border-paracosm-green bg-paracosm-green/20"
                  : "border-gray-600"
              }`} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
