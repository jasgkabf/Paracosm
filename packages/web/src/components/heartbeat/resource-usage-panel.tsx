"use client";

interface Resources {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

interface ResourceUsagePanelProps {
  resources: Resources;
}

export function ResourceUsagePanel({ resources }: ResourceUsagePanelProps) {
  const getUsageColor = (value: number) => {
    if (value < 50) return "bg-paracosm-green";
    if (value < 75) return "bg-paracosm-yellow";
    return "bg-paracosm-red";
  };

  const getUsageTextColor = (value: number) => {
    if (value < 50) return "text-paracosm-green";
    if (value < 75) return "text-paracosm-yellow";
    return "text-paracosm-red";
  };

  const items = [
    { label: "CPU", value: resources.cpu, unit: "%" },
    { label: "Memory", value: resources.memory, unit: "%" },
    { label: "Disk", value: resources.disk, unit: "%" },
    { label: "Network", value: resources.network, unit: "%" },
  ];

  return (
    <div className="glass-panel p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-4">Resource Usage</h3>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-white">{item.label}</span>
              <span className={`text-sm font-mono ${getUsageTextColor(item.value)}`}>
                {item.value}{item.unit}
              </span>
            </div>
            <div className="progress-bar-track">
              <div
                className={`progress-bar-fill ${getUsageColor(item.value)}`}
                style={{ width: `${item.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
