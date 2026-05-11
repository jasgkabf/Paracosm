"use client";

export function WorldStats() {
  const stats = [
    { label: "Entities", value: "24", color: "text-paracosm-green" },
    { label: "Relations", value: "47", color: "text-paracosm-cyan" },
    { label: "Constraints", value: "12", color: "text-paracosm-yellow" },
    { label: "Goals", value: "8", color: "text-paracosm-purple" },
    { label: "Events", value: "156", color: "text-paracosm-orange" },
    { label: "Depth", value: "5", color: "text-white" },
  ];

  return (
    <div className="glass-panel p-4 space-y-4">
      <h3 className="text-sm font-medium text-gray-400">World Statistics</h3>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-paracosm-dark/50 rounded-lg p-3">
            <div className="text-xs text-gray-500">{stat.label}</div>
            <div className={`text-xl font-mono font-bold mt-1 ${stat.color}`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>
      <div className="pt-3 border-t border-paracosm-gray-light/10">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Last updated</span>
          <span className="font-mono">Just now</span>
        </div>
      </div>
    </div>
  );
}
