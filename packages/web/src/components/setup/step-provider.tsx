"use client";

interface StepProviderProps {
  value: string;
  onChange: (provider: string) => void;
}

const providers = [
  { id: "openai", name: "OpenAI", description: "GPT-4, GPT-3.5 Turbo, and more" },
  { id: "anthropic", name: "Anthropic", description: "Claude 3 family of models" },
  { id: "google", name: "Google AI", description: "Gemini Pro and Ultra" },
  { id: "deepseek", name: "DeepSeek", description: "DeepSeek Chat and Coder" },
  { id: "ollama", name: "Ollama (Local)", description: "Run models locally" },
  { id: "custom", name: "Custom Provider", description: "OpenAI-compatible endpoint" },
];

export function StepProvider({ value, onChange }: StepProviderProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-2">Choose Your Provider</h2>
      <p className="text-sm text-gray-400 mb-6">
        Select the LLM provider you want to use. You can add more later.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {providers.map((provider) => (
          <button
            key={provider.id}
            onClick={() => onChange(provider.id)}
            className={`p-4 rounded-lg border text-left transition-colors ${
              value === provider.id
                ? "border-paracosm-green/50 bg-paracosm-green/5"
                : "border-paracosm-gray-light/20 hover:border-paracosm-gray-light/40"
            }`}
          >
            <h3 className="text-sm font-medium text-white">{provider.name}</h3>
            <p className="text-xs text-gray-400 mt-1">{provider.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
