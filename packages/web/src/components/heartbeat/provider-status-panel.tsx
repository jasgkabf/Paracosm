"use client";

interface Provider {
  name: string;
  connected: boolean;
  latency: number;
  errorRate: number;
}

interface ProviderStatusPanelProps {
  providers: Provider[];
}

const defaultProviders: Provider[] = [
  { name: "OpenAI", connected: true, latency: 245, errorRate: 0.02 },
  { name: "Anthropic", connected: true, latency: 312, errorRate: 0.01 },
  { name: "Google", connected: false, latency: 0, errorRate: 0 },
  { name: "Local (Ollama)", connected: true, latency: 45, errorRate: 0 },
  { name: "DeepSeek", connected: true, latency: 189, errorRate: 0.05 },
];

export function ProviderStatusPanel({ providers = defaultProviders }: ProviderStatusPanelProps) {
  const getLatencyColor = (latency: number) => {
    if (latency === 0) return "text-gray-600";
    if (latency < 200) return "text-paracosm-green";
    if (latency < 500) return "text-paracosm-yellow";
    return "text-paracosm-red";
  };

  const getErrorRateColor = (rate: number) => {
    if (rate === 0) return "text-paracosm-green";
    if (rate < 0.05) return "text-paracosm-yellow";
    return "text-paracosm-red";
  };

  return (
    <div className="glass-panel p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-4">LLM Providers</h3>
      <div className="space-y-3">
        {providers.map((provider) => (
          <div
            key={provider.name}
            className="flex items-center justify-between py-2 border-b border-paracosm-gray-light/10 last:border-0"
          >
            <div className="flex items-center gap-2">
              <div
                className={`status-dot ${
                  provider.connected ? "status-dot-online" : "status-dot-offline"
                }`}
              />
              <span className="text-sm text-white">{provider.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-gray-500">Latency</div>
                <div className={`text-xs font-mono ${getLatencyColor(provider.latency)}`}>
                  {provider.connected ? `${provider.latency}ms` : "--"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">Errors</div>
                <div className={`text-xs font-mono ${getErrorRateColor(provider.errorRate)}`}>
                  {provider.connected ? `${(provider.errorRate * 100).toFixed(1)}%` : "--"}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
