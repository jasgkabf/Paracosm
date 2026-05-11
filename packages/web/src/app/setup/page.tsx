'use client';

import { useState } from 'react';
import { IconParacosm, IconArrowRight, IconChevronRight } from '@/components/icons';

const STEPS = ['Welcome', 'API Keys', 'Providers', 'Complete'] as const;
type Step = (typeof STEPS)[number];

export default function SetupPage() {
  const [currentStep, setCurrentStep] = useState<Step>('Welcome');
  const stepIndex = STEPS.indexOf(currentStep);

  const nextStep = () => {
    const idx = STEPS.indexOf(currentStep);
    if (idx < STEPS.length - 1) {
      setCurrentStep(STEPS[idx + 1]);
    }
  };

  return (
    <div className="min-h-screen bg-paracosm-dark flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-8">
          <IconParacosm size={48} color="#00ff88" />
        </div>

        <h1 className="text-3xl font-bold text-center text-paracosm-text mb-2">
          Welcome to Paracosm
        </h1>
        <p className="text-paracosm-muted text-center mb-8">
          Let&apos;s set up your multi-agent AI orchestration framework
        </p>

        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  i < stepIndex
                    ? 'bg-paracosm-green text-paracosm-dark'
                    : i === stepIndex
                    ? 'bg-paracosm-green/20 text-paracosm-green border border-paracosm-green'
                    : 'bg-paracosm-gray text-paracosm-muted'
                }`}
              >
                {i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-8 h-px ${
                    i < stepIndex ? 'bg-paracosm-green' : 'bg-paracosm-border'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="glass-panel p-6 mb-6">
          {currentStep === 'Welcome' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-paracosm-text">Get Started</h2>
              <p className="text-paracosm-muted">
                Paracosm is a multi-agent AI orchestration framework that uses Construct-Simulate-Execute-Reflect-Evolve
                cycles to solve complex tasks. This wizard will help you configure your first LLM provider.
              </p>
            </div>
          )}
          {currentStep === 'API Keys' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-paracosm-text">API Keys</h2>
              <p className="text-paracosm-muted">
                Enter your LLM provider API keys. These are stored locally and encrypted.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-paracosm-muted mb-1">OpenAI API Key</label>
                  <input
                    type="password"
                    placeholder="sk-..."
                    className="w-full bg-paracosm-dark border border-paracosm-border rounded-md px-3 py-2 text-paracosm-text placeholder:text-paracosm-muted/50 focus:outline-none focus:border-paracosm-green/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-paracosm-muted mb-1">Anthropic API Key</label>
                  <input
                    type="password"
                    placeholder="sk-ant-..."
                    className="w-full bg-paracosm-dark border border-paracosm-border rounded-md px-3 py-2 text-paracosm-text placeholder:text-paracosm-muted/50 focus:outline-none focus:border-paracosm-green/50"
                  />
                </div>
              </div>
            </div>
          )}
          {currentStep === 'Providers' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-paracosm-text">Default Provider</h2>
              <p className="text-paracosm-muted">
                Select your default LLM provider and model.
              </p>
              <div>
                <label className="block text-sm text-paracosm-muted mb-1">Provider</label>
                <select className="w-full bg-paracosm-dark border border-paracosm-border rounded-md px-3 py-2 text-paracosm-text focus:outline-none focus:border-paracosm-green/50">
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                  <option value="mistral">Mistral</option>
                  <option value="local">Local</option>
                </select>
              </div>
            </div>
          )}
          {currentStep === 'Complete' && (
            <div className="space-y-4 text-center">
              <h2 className="text-xl font-semibold text-paracosm-green">Setup Complete</h2>
              <p className="text-paracosm-muted">
                Your Paracosm instance is ready. You can now start chatting with agents.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <button
            onClick={() => {
              const idx = STEPS.indexOf(currentStep);
              if (idx > 0) setCurrentStep(STEPS[idx - 1]);
            }}
            disabled={stepIndex === 0}
            className="px-4 py-2 rounded-md text-paracosm-muted hover:text-paracosm-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Back
          </button>
          {currentStep === 'Complete' ? (
            <a
              href="/chat"
              className="flex items-center gap-2 px-6 py-2 rounded-md bg-paracosm-green text-paracosm-dark font-medium hover:bg-paracosm-green/90 transition-colors"
            >
              Start Chatting
              <IconArrowRight size={16} />
            </a>
          ) : (
            <button
              onClick={nextStep}
              className="flex items-center gap-2 px-6 py-2 rounded-md bg-paracosm-green text-paracosm-dark font-medium hover:bg-paracosm-green/90 transition-colors"
            >
              Continue
              <IconChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
