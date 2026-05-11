"use client";

import { Badge } from "@/components/common/badge";

interface EntityNodeProps {
  name: string;
  type: string;
  selected?: boolean;
  onClick?: () => void;
}

const typeColors: Record<string, { bg: string; border: string; text: string }> = {
  agent: { bg: "bg-paracosm-green/10", border: "border-paracosm-green/30", text: "text-paracosm-green" },
  object: { bg: "bg-paracosm-cyan/10", border: "border-paracosm-cyan/30", text: "text-paracosm-cyan" },
  concept: { bg: "bg-paracosm-purple/10", border: "border-paracosm-purple/30", text: "text-paracosm-purple" },
  location: { bg: "bg-paracosm-yellow/10", border: "border-paracosm-yellow/30", text: "text-paracosm-yellow" },
  event: { bg: "bg-paracosm-orange/10", border: "border-paracosm-orange/30", text: "text-paracosm-orange" },
};

export function EntityNode({ name, type, selected, onClick }: EntityNodeProps) {
  const colors = typeColors[type] || typeColors.concept;

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
        selected
          ? `${colors.bg} ${colors.border} shadow-glow-sm`
          : `bg-paracosm-gray border-paracosm-gray-light/20 hover:border-paracosm-gray-light/40`
      }`}
    >
      <div className={`w-2 h-2 rounded-full ${colors.bg.replace("/10", "")}`} />
      <span className="text-sm text-white">{name}</span>
      <Badge size="sm" className={colors.text}>
        {type}
      </Badge>
    </button>
  );
}
