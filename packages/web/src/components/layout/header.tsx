"use client";

import { Breadcrumb } from "./breadcrumb";
import { ConnectionIndicator } from "@/components/heartbeat/connection-indicator";
import {
  IconSearch,
  IconBell,
  IconUser,
  IconSidebar,
} from "@/components/icons";
import { useState } from "react";

interface HeaderProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export function Header({ sidebarCollapsed, onToggleSidebar }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  return (
    <header className="flex items-center h-14 px-4 border-b border-paracosm-gray-light/20 bg-paracosm-gray-dark/50 backdrop-blur-sm">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-paracosm-gray-light/30 transition-colors lg:hidden"
        >
          <IconSidebar size={20} />
        </button>
        <Breadcrumb />
      </div>

      <div className="flex items-center gap-2">
        {showSearch ? (
          <div className="flex items-center gap-2 bg-paracosm-gray rounded-lg px-3 py-1.5 border border-paracosm-gray-light/30">
            <IconSearch size={16} className="text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none w-48"
              autoFocus
              onBlur={() => {
                if (!searchQuery) setShowSearch(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearchQuery("");
                  setShowSearch(false);
                }
              }}
            />
          </div>
        ) : (
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-paracosm-gray-light/30 transition-colors"
          >
            <IconSearch size={18} />
          </button>
        )}

        <ConnectionIndicator status="online" size="sm" />

        <button className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-paracosm-gray-light/30 transition-colors relative">
          <IconBell size={18} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-paracosm-red rounded-full" />
        </button>

        <button className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-paracosm-gray-light/30 transition-colors">
          <IconUser size={18} />
        </button>
      </div>
    </header>
  );
}
