"use client";

import { StepProvider } from "./step-provider";
import { StepApiKey } from "./step-api-key";
import { StepModel } from "./step-model";
import { StepRouting } from "./step-routing";
import { StepComplete } from "./step-complete";
import { useState } from "react";

interface SetupStep {
  id: string;
  title: string;
  description: string;
}

const steps: SetupStep[] = [
  { id: "provider", title: "Choose Provider", description: "Select your LLM provider" },
  { id: "api-key", title: "API Key", description: "Enter your API key" },
  { id: "model", title: "Select Model", description: "Choose a default model" },
  { id: "routing", title: "Routing", description: "Configure routing preferences" },
  { id: "complete", title: "Complete", description: "Setup finished" },
];

export function SetupWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [config, setConfig] = useState({
    provider: "",
    apiKey: "",
    model: "",
    routing: "smart",
  });

  const goNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const updateConfig = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  index < currentStep
                    ? "bg-paracosm-green text-paracosm-dark"
                    : index === currentStep
                    ? "bg-paracosm-green/20 text-paracosm-green border border-paracosm-green"
                    : "bg-paracosm-gray text-gray-500"
                }`}
              >
                {index < currentStep ? "V" : index + 1}
              </div>
              <span className={`text-xs mt-1 ${
                index <= currentStep ? "text-white" : "text-gray-500"
              }`}>
                {step.title}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-12 h-px mx-2 ${
                index < currentStep ? "bg-paracosm-green" : "bg-paracosm-gray-light/20"
              }`} />
            )}
          </div>
        ))}
      </div>

      <div className="min-h-[300px]">
        {currentStep === 0 && (
          <StepProvider
            value={config.provider}
            onChange={(v) => updateConfig("provider", v)}
          />
        )}
        {currentStep === 1 && (
          <StepApiKey
            provider={config.provider}
            value={config.apiKey}
            onChange={(v) => updateConfig("apiKey", v)}
          />
        )}
        {currentStep === 2 && (
          <StepModel
            provider={config.provider}
            value={config.model}
            onChange={(v) => updateConfig("model", v)}
          />
        )}
        {currentStep === 3 && (
          <StepRouting
            value={config.routing}
            onChange={(v) => updateConfig("routing", v)}
          />
        )}
        {currentStep === 4 && <StepComplete config={config} />}
      </div>

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-paracosm-gray-light/10">
        <button
          onClick={goBack}
          disabled={currentStep === 0}
          className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Back
        </button>
        <button
          onClick={goNext}
          disabled={currentStep === steps.length - 1}
          className="px-4 py-2 text-sm bg-paracosm-green/20 text-paracosm-green rounded-lg hover:bg-paracosm-green/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {currentStep === steps.length - 2 ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  );
}
