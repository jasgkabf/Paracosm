import React, { useState, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";

interface WizardStep {
  id: string;
  title: string;
  description: string;
  type: "text" | "select" | "confirm" | "password";
  options?: string[];
  defaultValue?: string;
  field: string;
}

interface ConfigWizardProps {
  initialConfig: Record<string, unknown>;
  onComplete: (config: unknown) => Promise<void>;
}

const STEPS: WizardStep[] = [
  {
    id: "welcome",
    title: "Welcome",
    description: "This wizard will guide you through configuring Paracosm.",
    type: "confirm",
    field: "_continue",
    defaultValue: "yes",
  },
  {
    id: "port",
    title: "Server Port",
    description: "The port the Paracosm server will listen on.",
    type: "text",
    field: "app.port",
    defaultValue: "7529",
  },
  {
    id: "environment",
    title: "Environment",
    description: "Select the runtime environment.",
    type: "select",
    field: "app.environment",
    options: ["development", "production", "test"],
    defaultValue: "development",
  },
  {
    id: "log-level",
    title: "Log Level",
    description: "Select the logging verbosity level.",
    type: "select",
    field: "app.logLevel",
    options: ["trace", "debug", "info", "warn", "error"],
    defaultValue: "info",
  },
  {
    id: "default-provider",
    title: "Default Provider",
    description: "Select the default LLM provider.",
    type: "select",
    field: "llm.defaultProvider",
    options: ["openai", "anthropic", "google", "deepseek", "ollama"],
    defaultValue: "openai",
  },
  {
    id: "default-model",
    title: "Default Model",
    description: "Select the default model for chat.",
    type: "select",
    field: "llm.defaultModel",
    options: [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo",
      "claude-sonnet-4-20250514",
      "claude-haiku-3-5-20241022",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      "deepseek-v3",
      "deepseek-chat",
    ],
    defaultValue: "gpt-4o-mini",
  },
  {
    id: "openai-key",
    title: "OpenAI API Key",
    description: "Enter your OpenAI API key (leave empty to skip).",
    type: "password",
    field: "providers.openai.apiKey",
    defaultValue: "",
  },
  {
    id: "anthropic-key",
    title: "Anthropic API Key",
    description: "Enter your Anthropic API key (leave empty to skip).",
    type: "password",
    field: "providers.anthropic.apiKey",
    defaultValue: "",
  },
  {
    id: "google-key",
    title: "Google API Key",
    description: "Enter your Google AI API key (leave empty to skip).",
    type: "password",
    field: "providers.google.apiKey",
    defaultValue: "",
  },
  {
    id: "temperature",
    title: "Temperature",
    description: "Default sampling temperature (0.0 - 2.0).",
    type: "text",
    field: "llm.temperature",
    defaultValue: "0.7",
  },
  {
    id: "max-tokens",
    title: "Max Tokens",
    description: "Default maximum tokens in responses.",
    type: "text",
    field: "llm.maxTokens",
    defaultValue: "4096",
  },
  {
    id: "streaming",
    title: "Streaming",
    description: "Enable streaming responses by default?",
    type: "confirm",
    field: "llm.stream",
    defaultValue: "yes",
  },
  {
    id: "daily-budget",
    title: "Daily Budget",
    description: "Daily spending limit in USD.",
    type: "text",
    field: "budget.dailyLimitUsd",
    defaultValue: "10",
  },
  {
    id: "monthly-budget",
    title: "Monthly Budget",
    description: "Monthly spending limit in USD.",
    type: "text",
    field: "budget.monthlyLimitUsd",
    defaultValue: "100",
  },
  {
    id: "complete",
    title: "Configuration Complete",
    description: "Your configuration is ready. Save it now?",
    type: "confirm",
    field: "_save",
    defaultValue: "yes",
  },
];

function StepIndicator({
  current,
  total,
}: {
  current: number;
  total: number;
}): React.ReactElement {
  const steps: React.ReactElement[] = [];
  for (let i = 0; i < total; i++) {
    if (i === current) {
      steps.push(
        <Text key={i} color="cyan" bold>
          {" > "}
        </Text>
      );
    } else if (i < current) {
      steps.push(
        <Text key={i} color="green">
          {" = "}
        </Text>
      );
    } else {
      steps.push(
        <Text key={i} dimColor>
          {" - "}
        </Text>
      );
    }
  }
  return (
    <Box>
      <Text dimColor>
        Step {current + 1}/{total}
      </Text>
      <Text> </Text>
      {steps}
    </Box>
  );
}

function SelectInput({
  options,
  selectedIndex,
  onSelect,
}: {
  options: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}): React.ReactElement {
  return (
    <Box flexDirection="column">
      {options.map((option, index) => (
        <Box key={option}>
          <Text color={index === selectedIndex ? "cyan" : undefined} bold={index === selectedIndex}>
            {index === selectedIndex ? " > " : "   "}
          </Text>
          <Text
            color={index === selectedIndex ? "cyan" : undefined}
            bold={index === selectedIndex}
          >
            {option}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

export function ConfigWizard({
  initialConfig,
  onComplete,
}: ConfigWizardProps): React.ReactElement {
  const { exit } = useApp();
  const [currentStep, setCurrentStep] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [config, setConfig] = useState<Record<string, unknown>>({
    ...initialConfig,
  });
  const [completed, setCompleted] = useState(false);

  const step = STEPS[currentStep];

  const setNestedValue = useCallback(
    (obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> => {
      const keys = path.split(".");
      const result = { ...obj };
      let target: Record<string, unknown> = result;

      for (let i = 0; i < keys.length - 1; i++) {
        if (typeof target[keys[i]] !== "object" || target[keys[i]] === null) {
          target[keys[i]] = {};
        }
        target = target[keys[i]] as Record<string, unknown>;
      }

      target[keys[keys.length - 1]] = value;
      return result;
    },
    []
  );

  const handleNext = useCallback(() => {
    const stepConfig = STEPS[currentStep];
    let value: unknown = inputValue;

    if (stepConfig.type === "select") {
      value = stepConfig.options?.[selectedIndex] ?? stepConfig.defaultValue;
    } else if (stepConfig.type === "confirm") {
      value = inputValue.toLowerCase() === "yes" || inputValue === "y" || inputValue === "" && stepConfig.defaultValue === "yes";
    } else if (stepConfig.type === "password") {
      value = inputValue || "";
    } else if (stepConfig.type === "text") {
      value = inputValue || stepConfig.defaultValue || "";
      if (/^\d+$/.test(value as string)) value = parseInt(value as string, 10);
      else if (/^\d+\.\d+$/.test(value as string)) value = parseFloat(value as string);
    }

    if (stepConfig.field.startsWith("_")) {
      if (stepConfig.field === "_save" && value) {
        onComplete(config);
        setCompleted(true);
        return;
      }
    } else {
      setConfig((prev) => setNestedValue(prev, stepConfig.field, value));
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
      setInputValue("");
      setSelectedIndex(0);
    }
  }, [currentStep, inputValue, selectedIndex, config, onComplete, setNestedValue]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      setInputValue("");
      setSelectedIndex(0);
    }
  }, [currentStep]);

  useInput((inputKey, key) => {
    if (completed) {
      if (key.return) {
        exit();
      }
      return;
    }

    if (key.ctrl && inputKey === "c") {
      exit();
      return;
    }

    if (key.escape) {
      handleBack();
      return;
    }

    if (key.return) {
      handleNext();
      return;
    }

    if (step.type === "select") {
      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
        return;
      }
      if (key.downArrow) {
        setSelectedIndex((prev) =>
          Math.min((step.options?.length ?? 1) - 1, prev + 1)
        );
        return;
      }
      return;
    }

    if (step.type === "confirm") {
      if (inputKey === "y" || inputKey === "Y") {
        setInputValue("yes");
      } else if (inputKey === "n" || inputKey === "N") {
        setInputValue("no");
      }
      return;
    }

    if (key.backspace || key.delete) {
      setInputValue((prev) => prev.slice(0, -1));
      return;
    }

    if (inputKey && !key.ctrl && !key.meta) {
      setInputValue((prev) => prev + inputKey);
    }
  });

  if (completed) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="green" bold>
          Configuration saved successfully!
        </Text>
        <Text dimColor>Press Enter to exit.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <StepIndicator current={currentStep} total={STEPS.length} />

      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        padding={1}
        marginY={1}
      >
        <Text bold color="cyan">
          {step.title}
        </Text>
        <Text dimColor>{step.description}</Text>

        <Box marginTop={1}>
          {step.type === "select" ? (
            <SelectInput
              options={step.options ?? []}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
            />
          ) : step.type === "confirm" ? (
            <Box>
              <Text>
                {inputValue || step.defaultValue || "yes"} (y/n)
              </Text>
            </Box>
          ) : step.type === "password" ? (
            <Box>
              <Text color="gray">
                {inputValue ? "*".repeat(inputValue.length) : "(hidden)"}
              </Text>
            </Box>
          ) : (
            <Box>
              <Text>
                {inputValue || step.defaultValue || ""}
              </Text>
              <Text backgroundColor="cyan"> </Text>
            </Box>
          )}
        </Box>
      </Box>

      <Box>
        <Text dimColor>
          Enter: next | Esc: back | Ctrl+C: cancel
        </Text>
      </Box>
    </Box>
  );
}
