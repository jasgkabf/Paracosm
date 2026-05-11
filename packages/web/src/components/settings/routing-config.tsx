"use client";

import { Button } from "@/components/common/button";
import { Switch } from "@/components/common/switch";
import { IconShield } from "@/components/icons";
import { useState } from "react";

interface RoutingRule {
  id: string;
  name: string;
  condition: string;
  targetModel: string;
  priority: number;
  enabled: boolean;
}

const mockRules: RoutingRule[] = [
  { id: "r1", name: "Code Tasks", condition: "task_type = 'code'", targetModel: "gpt-4", priority: 1, enabled: true },
  { id: "r2", name: "Analysis Tasks", condition: "task_type = 'analysis'", targetModel: "claude-3-opus", priority: 2, enabled: true },
  { id: "r3", name: "Simple Chat", condition: "complexity < 0.3", targetModel: "gpt-3.5-turbo", priority: 3, enabled: true },
  { id: "r4", name: "Long Context", condition: "token_count > 50000", targetModel: "claude-3-sonnet", priority: 4, enabled: false },
  { id: "r5", name: "Budget Saver", condition: "budget_remaining < 0.2", targetModel: "llama3", priority: 5, enabled: true },
];

export function RoutingConfig() {
  const [rules, setRules] = useState<RoutingRule[]>(mockRules);

  const toggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconShield size={18} className="text-paracosm-purple" />
          <h3 className="text-sm font-medium text-white">Routing Rules</h3>
        </div>
        <Button variant="primary" size="sm">Add Rule</Button>
      </div>

      <p className="text-xs text-gray-400">
        Rules are evaluated in priority order. The first matching rule determines the model selection.
      </p>

      <div className="space-y-3">
        {rules.map((rule) => (
          <div key={rule.id} className={`glass-panel p-4 ${!rule.enabled ? "opacity-50" : ""}`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-mono">#{rule.priority}</span>
                  <h4 className="text-sm font-medium text-white">{rule.name}</h4>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <code className="text-xs text-paracosm-cyan bg-paracosm-dark/50 px-2 py-0.5 rounded">
                    {rule.condition}
                  </code>
                  <span className="text-xs text-gray-500">then</span>
                  <span className="text-xs text-paracosm-green font-mono">{rule.targetModel}</span>
                </div>
              </div>
              <Switch checked={rule.enabled} onChange={() => toggleRule(rule.id)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
