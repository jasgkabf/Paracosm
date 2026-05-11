import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';

interface Step {
  label: string;
  field: string;
  type: 'text' | 'select';
  options?: string[];
}

const STEPS: Step[] = [
  { label: 'Default Provider', field: 'defaultProvider', type: 'select', options: ['openai', 'anthropic', 'google', 'mistral', 'local'] },
  { label: 'Default Model', field: 'defaultModel', type: 'text' },
  { label: 'OpenAI API Key', field: 'openaiApiKey', type: 'text' },
  { label: 'Anthropic API Key', field: 'anthropicApiKey', type: 'text' },
  { label: 'Server Port', field: 'port', type: 'text' },
];

export function ConfigWizard() {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({
    defaultProvider: 'openai',
    defaultModel: 'gpt-4o',
    openaiApiKey: '',
    anthropicApiKey: '',
    port: '7529',
  });
  const [input, setInput] = useState('');
  const [selectIndex, setSelectIndex] = useState(0);
  const [done, setDone] = useState(false);
  const { exit } = useApp();

  useInput((char, key) => {
    if (done) {
      if (key.return) exit();
      return;
    }

    if (key.escape) {
      exit();
      return;
    }

    const currentStep = STEPS[step];

    if (currentStep.type === 'select') {
      if (key.upArrow) {
        setSelectIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectIndex((prev) => Math.min((currentStep.options?.length ?? 0) - 1, prev + 1));
      } else if (key.return) {
        const selected = currentStep.options?.[selectIndex] ?? '';
        setValues((prev) => ({ ...prev, [currentStep.field]: selected }));
        nextStep();
      }
    } else {
      if (key.return) {
        setValues((prev) => ({ ...prev, [currentStep.field]: input || prev[currentStep.field] }));
        nextStep();
      } else if (key.backspace || key.delete) {
        setInput((prev) => prev.slice(0, -1));
      } else if (!key.ctrl && !key.meta) {
        setInput((prev) => prev + char);
      }
    }
  });

  const nextStep = () => {
    setInput('');
    setSelectIndex(0);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      setDone(true);
    }
  };

  if (done) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="green">Configuration Complete</Text>
        <Box marginTop={1}>
          <Text color="gray">Values:</Text>
        </Box>
        {Object.entries(values).map(([key, val]) => (
          <Box key={key}>
            <Text color="cyan">{key}: </Text>
            <Text>{val ? (key.includes('Key') ? '****' : val) : '(not set)'}</Text>
          </Box>
        ))}
        <Box marginTop={1}>
          <Text color="gray">Press Enter to exit</Text>
        </Box>
      </Box>
    );
  }

  const currentStep = STEPS[step];

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="green">Paracosm Configuration Wizard</Text>
      <Box marginTop={1}>
        <Text color="gray">Step {step + 1}/{STEPS.length}: {currentStep.label}</Text>
      </Box>

      {currentStep.type === 'select' && currentStep.options && (
        <Box flexDirection="column" marginTop={1}>
          {currentStep.options.map((opt, i) => (
            <Box key={opt}>
              <Text color={i === selectIndex ? 'green' : 'gray'}>
                {i === selectIndex ? '> ' : '  '}{opt}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {currentStep.type === 'text' && (
        <Box marginTop={1}>
          <Text color="cyan">{currentStep.label}: </Text>
          <Text>{input}_</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="gray">Enter to confirm, Esc to cancel</Text>
      </Box>
    </Box>
  );
}
