"use client";

import { Button } from "@/components/common/button";
import { Badge } from "@/components/common/badge";
import { IconBrain, IconPlus, IconTrash, IconEdit } from "@/components/icons";
import { useState } from "react";

interface Persona {
  id: string;
  name: string;
  description: string;
  traits: string[];
  model: string;
  active: boolean;
}

const mockPersonas: Persona[] = [
  { id: "p1", name: "Analyst", description: "Careful, methodical analysis with detailed reasoning", traits: ["methodical", "cautious", "detailed"], model: "gpt-4", active: true },
  { id: "p2", name: "Explorer", description: "Creative exploration with risk-taking tendencies", traits: ["creative", "bold", "curious"], model: "claude-3-opus", active: false },
  { id: "p3", name: "Optimizer", description: "Efficiency-focused with cost-awareness", traits: ["efficient", "pragmatic", "cost-aware"], model: "gpt-3.5-turbo", active: false },
];

export function PersonaConfig() {
  const [personas, setPersonas] = useState<Persona[]>(mockPersonas);

  const toggleActive = (id: string) => {
    setPersonas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p))
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-400">Agent Personas</h3>
        <Button variant="primary" size="sm">
          <IconPlus size={14} />
          <span className="ml-2">New Persona</span>
        </Button>
      </div>

      <div className="space-y-3">
        {personas.map((persona) => (
          <div key={persona.id} className={`glass-panel p-4 ${persona.active ? "border-paracosm-green/20" : ""}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  persona.active ? "bg-paracosm-green/20" : "bg-paracosm-gray"
                }`}>
                  <IconBrain size={20} className={persona.active ? "text-paracosm-green" : "text-gray-400"} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-white">{persona.name}</h4>
                    {persona.active && <Badge size="sm" className="text-paracosm-green">Active</Badge>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{persona.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {persona.traits.map((trait) => (
                      <Badge key={trait} size="sm" variant="info">{trait}</Badge>
                    ))}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Model: {persona.model}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => toggleActive(persona.id)}>
                  {persona.active ? "Deactivate" : "Activate"}
                </Button>
                <Button variant="ghost" size="sm">
                  <IconEdit size={14} />
                </Button>
                <Button variant="ghost" size="sm" className="text-paracosm-red">
                  <IconTrash size={14} />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
