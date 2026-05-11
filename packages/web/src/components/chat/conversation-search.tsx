"use client";

import { IconSearch, IconX } from "@/components/icons";

interface ConversationSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
}

export function ConversationSearch({ query, onQueryChange }: ConversationSearchProps) {
  return (
    <div className="relative">
      <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
      <input
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search conversations..."
        className="w-full bg-paracosm-gray border border-paracosm-gray-light/20 rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-paracosm-green/30"
      />
      {query && (
        <button
          onClick={() => onQueryChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-500 hover:text-white transition-colors"
        >
          <IconX size={14} />
        </button>
      )}
    </div>
  );
}
