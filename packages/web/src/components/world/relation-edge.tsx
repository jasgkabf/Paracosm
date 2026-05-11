"use client";

interface RelationEdgeProps {
  source: string;
  target: string;
  label: string;
  type?: string;
}

export function RelationEdge({ source, target, label, type = "default" }: RelationEdgeProps) {
  const typeColors: Record<string, string> = {
    default: "border-paracosm-cyan/30",
    causal: "border-paracosm-green/30",
    temporal: "border-paracosm-yellow/30",
    spatial: "border-paracosm-purple/30",
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${typeColors[type]} bg-paracosm-gray/50`}>
      <span className="text-sm text-white">{source}</span>
      <div className="flex items-center gap-1">
        <div className="w-4 h-px bg-paracosm-cyan/50" />
        <span className="text-xs text-paracosm-cyan font-mono px-1.5 py-0.5 bg-paracosm-cyan/10 rounded">
          {label}
        </span>
        <div className="w-4 h-px bg-paracosm-cyan/50" />
      </div>
      <span className="text-sm text-white">{target}</span>
    </div>
  );
}
