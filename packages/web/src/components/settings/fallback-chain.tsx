"use client";

import { Badge } from "@/components/common/badge";
import { IconChevronDown, IconChevronUp } from "@/components/icons";
import { useState } from "react";

interface FallbackStep {
  model: string;
  provider: string;
  condition: string;
}

interface FallbackChain {
  id: string;
  name: string;
  steps: FallbackStep[];
  active: boolean;
}

const mockChains: FallbackChain[] = [
  {
    id: "fc1",
    name: "Default Chain",
    active: true,
    steps: [
      { model: "gpt-4", provider: "OpenAI", condition: "Primary" },
      { model: "claude-3-sonnet", provider: "Anthropic", condition: "If OpenAI unavailable" },
      { model: "llama3", provider: "Ollama", condition: "If all cloud providers fail" },
    ],
  },
  {
    id: "fc2",
    name: "Budget Saver Chain",
    active: false,
    steps: [
      { model: "llama3", provider: "Ollama", condition: "Primary (free)" },
      { model: "gpt-3.5-turbo", provider: "OpenAI", condition: "If local unavailable" },
    ],
  },
];

export function FallbackChain() {
  const [chains, setChains] = useState<FallbackChain[]>(mockChains);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ fc1: true });

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-white">Fallback Chains</h3>
      <p className="text-xs text-gray-400">
        Define ordered fallback sequences when primary models are unavailable.
      </p>

      <div className="space-y-3">
        {chains.map((chain) => (
          <div key={chain.id} className="glass-panel p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium text-white">{chain.name}</h4>
                {chain.active && <Badge size="sm" className="text-paracosm-green">Active</Badge>}
              </div>
              <button
                onClick={() => toggleExpand(chain.id)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {expanded[chain.id] ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
              </button>
            </div>

            {expanded[chain.id] && (
              <div className="mt-3 space-y-2">
                {chain.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-3 pl-4">
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full bg-paracosm-green/20 flex items-center justify-center text-xs text-paracosm-green font-mono">
                        {i + 1}
                      </div>
                      {i < chain.steps.length - 1 && (
                        <div className="w-px h-4 bg-paracosm-gray-light/20" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-mono">{step.model}</span>
                        <Badge size="sm">{step.provider}</Badge>
                      </div>
                      <span className="text-xs text-gray-500">{step.condition}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
