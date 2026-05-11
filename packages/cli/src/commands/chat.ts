import { Command } from "commander";
import chalk from "chalk";
import { render } from "ink";
import React from "react";
import {
  APP_NAME,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS,
  MODEL_CAPABILITIES,
  MODEL_PRICING,
} from "@paracosm/shared";
import type { ModelId } from "@paracosm/shared";
import { InteractiveChat } from "../ui/interactive-chat.js";
import { formatOutput } from "../utils/output.js";
import { resolveConfig } from "../utils/config-resolver.js";

interface ChatOptions {
  model?: string;
  temperature?: string;
  maxTokens?: string;
  stream?: boolean;
  noStream?: boolean;
  system?: string;
  file?: string;
  interactive?: boolean;
  format?: "json" | "text" | "markdown";
  config?: string;
}

interface MessageEntry {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: string;
}

function buildMessages(
  prompt: string | undefined,
  options: ChatOptions
): MessageEntry[] {
  const messages: MessageEntry[] = [];
  const now = new Date().toISOString();

  if (options.system) {
    messages.push({
      role: "system",
      content: options.system,
      timestamp: now,
    });
  }

  if (prompt) {
    messages.push({
      role: "user",
      content: prompt,
      timestamp: now,
    });
  }

  return messages;
}

async function sendMessage(
  messages: MessageEntry[],
  model: string,
  temperature: number,
  maxTokens: number,
  stream: boolean
): Promise<string> {
  const config = await resolveConfig();
  const baseUrl = `http://localhost:${config.port || 7529}/api/v1`;

  const requestBody = {
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    model,
    temperature,
    maxTokens,
    stream,
  };

  const response = await fetch(`${baseUrl}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Chat request failed (${response.status}): ${errorBody}`);
  }

  if (stream && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter((line) => line.startsWith("data: "));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === "[DONE]") break;
        try {
          const parsed = JSON.parse(data) as { content?: string };
          if (parsed.content) {
            process.stdout.write(parsed.content);
            fullContent += parsed.content;
          }
        } catch {
          continue;
        }
      }
    }

    process.stdout.write("\n");
    return fullContent;
  }

  const result = (await response.json()) as { content?: string };
  return result.content ?? "";
}

async function handleSingleMessage(
  prompt: string,
  options: ChatOptions
): Promise<void> {
  const model = options.model ?? "gpt-4o-mini";
  const temperature = options.temperature
    ? parseFloat(options.temperature)
    : DEFAULT_TEMPERATURE;
  const maxTokens = options.maxTokens
    ? parseInt(options.maxTokens, 10)
    : DEFAULT_MAX_TOKENS;
  const stream = options.noStream ? false : (options.stream ?? true);

  const messages = buildMessages(prompt, options);
  if (messages.length === 0) {
    console.error(chalk.red("No message provided. Use --interactive for a chat session."));
    process.exit(1);
  }

  try {
    const content = await sendMessage(messages, model, temperature, maxTokens, stream);

    if (options.format === "json") {
      formatOutput(
        {
          model,
          messages: messages.length,
          response: content,
          temperature,
          maxTokens,
        },
        { format: "json", colorize: true }
      );
    } else if (options.format === "markdown") {
      console.log(content);
    } else {
      console.log(content);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
}

async function handleInteractiveChat(options: ChatOptions): Promise<void> {
  const model = options.model ?? "gpt-4o-mini";
  const temperature = options.temperature
    ? parseFloat(options.temperature)
    : DEFAULT_TEMPERATURE;
  const maxTokens = options.maxTokens
    ? parseInt(options.maxTokens, 10)
    : DEFAULT_MAX_TOKENS;
  const stream = options.noStream ? false : (options.stream ?? true);

  const config = await resolveConfig();

  const { waitUntilExit } = render(
    React.createElement(InteractiveChat, {
      model,
      temperature,
      maxTokens,
      stream,
      systemPrompt: options.system,
      baseUrl: `http://localhost:${config.port || 7529}/api/v1`,
    })
  );

  await waitUntilExit();
}

function handleModelList(): void {
  const models = Object.entries(MODEL_CAPABILITIES) as [ModelId, (typeof MODEL_CAPABILITIES)[ModelId]][];
  const rows = models.map(([id, caps]) => ({
    id,
    contextWindow: caps.contextWindow.toLocaleString(),
    streaming: caps.supportsStreaming ? "yes" : "no",
    functionCalling: caps.supportsFunctionCalling ? "yes" : "no",
    vision: caps.supportsVision ? "yes" : "no",
    maxOutput: caps.maxOutputTokens.toLocaleString(),
    inputCost: `$${MODEL_PRICING[id].inputPer1K.toFixed(5)}`,
    outputCost: `$${MODEL_PRICING[id].outputPer1K.toFixed(5)}`,
  }));

  formatOutput(rows, { format: "table", colorize: true });
}

export function registerChatCommand(program: Command): void {
  const chat = program
    .command("chat")
    .description("Interact with the Paracosm agent");

  chat
    .command("send")
    .description("Send a single message to the agent")
    .argument("[prompt]", "the message to send")
    .option("-m, --model <model>", "model to use")
    .option("-t, --temperature <number>", "sampling temperature")
    .option("--max-tokens <number>", "maximum tokens in response")
    .option("--stream", "stream the response", true)
    .option("--no-stream", "disable streaming")
    .option("-s, --system <prompt>", "system prompt")
    .option("-f, --format <format>", "output format: json, text, markdown")
    .action(async (prompt: string | undefined, options: ChatOptions) => {
      await handleSingleMessage(prompt ?? "", options);
    });

  chat
    .command("interactive")
    .description("Start an interactive chat session")
    .option("-m, --model <model>", "model to use")
    .option("-t, --temperature <number>", "sampling temperature")
    .option("--max-tokens <number>", "maximum tokens in response")
    .option("--stream", "stream the response", true)
    .option("--no-stream", "disable streaming")
    .option("-s, --system <prompt>", "system prompt")
    .action(async (options: ChatOptions) => {
      await handleInteractiveChat(options);
    });

  chat
    .command("models")
    .description("List available models and their capabilities")
    .action(() => {
      handleModelList();
    });

  chat
    .command("stream")
    .description("Stream a response from the agent")
    .argument("[prompt]", "the message to send")
    .option("-m, --model <model>", "model to use")
    .option("-t, --temperature <number>", "sampling temperature")
    .option("--max-tokens <number>", "maximum tokens in response")
    .option("-s, --system <prompt>", "system prompt")
    .action(async (prompt: string | undefined, options: ChatOptions) => {
      await handleSingleMessage(prompt ?? "", { ...options, stream: true });
    });

  chat
    .command("select")
    .description("Select and configure the default model")
    .argument("<model>", "model identifier to set as default")
    .action(async (model: string) => {
      const knownModels = Object.keys(MODEL_CAPABILITIES);
      if (!knownModels.includes(model)) {
        console.error(
          chalk.red(`Unknown model: ${model}`),
          chalk.gray(`Available: ${knownModels.join(", ")}`)
        );
        process.exit(1);
      }

      const config = await resolveConfig();
      config.defaultModel = model;

      console.log(chalk.green(`Default model set to: ${model}`));
      const caps = MODEL_CAPABILITIES[model as ModelId];
      console.log(chalk.gray(`  Context window: ${caps.contextWindow.toLocaleString()}`));
      console.log(chalk.gray(`  Max output: ${caps.maxOutputTokens.toLocaleString()}`));
      console.log(chalk.gray(`  Streaming: ${caps.supportsStreaming ? "yes" : "no"}`));
      console.log(chalk.gray(`  Function calling: ${caps.supportsFunctionCalling ? "yes" : "no"}`));
      console.log(chalk.gray(`  Vision: ${caps.supportsVision ? "yes" : "no"}`));
    });
}
