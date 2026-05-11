"use client";

interface StepModelProps {
  provider: string;
  value: string;
  onChange: (model: string) => void;
}

const providerModels: Record<string, Array<{ id: string; name: string; description: string }>> = {
  openai: [
    { id: "gpt-4", name: "GPT-4", description: "Most capable model" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo", description: "Fast and capable" },
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", description: "Fast and affordable" },
  ],
  anthropic: [
    { id: "claude-3-opus", name: "Claude 3 Opus", description: "Most powerful" },
    { id: "claude-3-sonnet", name: "Claude 3 Sonnet", description: "Balanced performance" },
    { id: "claude-3-haiku", name: "Claude 3 Haiku", description: "Fast and affordable" },
  ],
  google: [
    { id: "gemini-pro", name: "Gemini Pro", description: "General purpose" },
    { id: "gemini-ultra", name: "Gemini Ultra", description: "Most capable" },
  ],
  deepseek: [
    { id: "deepseek-chat", name: "DeepSeek Chat", description: "General chat model" },
    { id: "deepseek-coder", name: "DeepSeek Coder", description: "Code-focused model" },
  ],
  ollama: [
    { id: "llama3", name: "Llama 3", description: "Meta's open model" },
    { id: "mistral", name: "Mistral", description: "Efficient open model" },
    { id: "codellama", name: "Code Llama", description: "Code generation model" },
  ],
};

export function StepModel({ provider, value, onChange }: StepModelProps) {
  const models = providerModels[provider] || providerModels.openai;

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-2">Select Default Model</h2>
      <p className="text-sm text-gray-400 mb-6">
        Choose the default model for your agent. You can change this later.
      </p>
      <div className="space-y-3">
        {models.map((model) => (
          <button
            key={model.id}
            onClick={() => onChange(model.id)}
            className={`w-full p-4 rounded-lg border text-left transition-colors ${
              value === model.id
                ? "border-paracosm-green/50 bg-paracosm-green/5"
                : "border-paracosm-gray-light/20 hover:border-paracosm-gray-light/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-white">{model.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{model.description}</p>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 ${
                value === model.id
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
