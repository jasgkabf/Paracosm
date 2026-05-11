"use client";

import { IconHeartbeat } from "@/components/icons";

export function Footer() {
  return (
    <footer className="flex items-center justify-between h-8 px-4 border-t border-paracosm-gray-light/20 bg-paracosm-gray-dark/50 text-xs text-gray-500">
      <div className="flex items-center gap-2">
        <IconHeartbeat size={12} className="text-paracosm-green" />
        <span>Paracosm Agent v0.1.0</span>
      </div>
      <div className="flex items-center gap-4">
        <span>Engine: Active</span>
        <span>|</span>
        <span>Uptime: 0:00:00</span>
      </div>
    </footer>
  );
}
