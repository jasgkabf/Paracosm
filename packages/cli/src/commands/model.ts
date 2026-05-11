import { Command } from "commander";
import chalk from "chalk";
import {
  MODEL_CAPABILITIES,
  MODEL_PRICING,
  OPENAI_MODELS,
  ANTHROPIC_MODELS,
  GOOGLE_MODELS,
  DEEPSEEK_MODELS,
  LOCAL_MODELS,
} from "@paracosm/shared";
import type { ModelId } from "@paracosm/shared";
import { formatOutput } from "../utils/output.js";
import { resolveConfig } from "../utils/config-resolver.js";

interface ModelListOptions {
  provider?: string;
  capability?: string;
  format?: "json" | "table";
}

interface ModelTestOptions {
  prompt?: string;
  iterations?: string;
  timeout?: string;
}

interface ModelBenchmarkOptions {
  iterations?: string;
  warmup?: string;
  concurrent?: string;
  promptLength?: string;
}

interface ModelCostOptions {
  period?: "day" | "week" | "month";
  format?: "json" | "table";
}

interface ModelRecommendOptions {
  task?: string;
  budget?: string;
  latency?: string;
  context?: string;
}

const PROVIDER_GROUPS: Record<string, readonly ModelId[]> = {
  openai: OPENAI_MODELS,
  anthropic: ANTHROPIC_MODELS,
  google: GOOGLE_MODELS,
  deepseek: DEEPSEEK_MODELS,
  local: LOCAL_MODELS,
};

async function handleModelList(options: ModelListOptions): Promise<void> {
  let models = Object.entries(MODEL_CAPABILITIES) as [ModelId, (typeof MODEL_CAPABILITIES)[ModelId]][];

  if (options.provider) {
    const providerModels = PROVIDER_GROUPS[options.provider.toLowerCase()];
    if (!providerModels) {
      console.error(
        chalk.red(`Unknown provider: ${options.provider}`),
        chalk.gray(`Available: ${Object.keys(PROVIDER_GROUPS).join(", ")}`)
      );
      process.exit(1);
    }
    models = models.filter(([id]) => providerModels.includes(id));
  }

  if (options.capability) {
    const cap = options.capability.toLowerCase();
    models = models.filter(([, caps]) => {
      if (cap === "streaming") return caps.supportsStreaming;
      if (cap === "function_calling" || cap === "function-calling") return caps.supportsFunctionCalling;
      if (cap === "vision") return caps.supportsVision;
      return true;
    });
  }

  const rows = models.map(([id, caps]) => {
    const pricing = MODEL_PRICING[id];
    return {
      id,
      contextWindow: caps.contextWindow.toLocaleString(),
      streaming: caps.supportsStreaming ? "yes" : "no",
      functionCalling: caps.supportsFunctionCalling ? "yes" : "no",
      vision: caps.supportsVision ? "yes" : "no",
      maxOutput: caps.maxOutputTokens.toLocaleString(),
      inputPer1K: `$${pricing.inputPer1K.toFixed(5)}`,
      outputPer1K: `$${pricing.outputPer1K.toFixed(5)}`,
    };
  });

  formatOutput(rows, { format: options.format ?? "table", colorize: true });
}

async function handleModelTest(model: string, options: ModelTestOptions): Promise<void> {
  const knownModels = Object.keys(MODEL_CAPABILITIES);
  if (!knownModels.includes(model)) {
    console.error(chalk.red(`Unknown model: ${model}`));
    process.exit(1);
  }

  const config = await resolveConfig();
  const baseUrl = `http://localhost:${config.port || 7529}/api/v1`;
  const prompt = options.prompt ?? "Hello, respond with a single word.";
  const iterations = options.iterations ? parseInt(options.iterations, 10) : 1;
  const timeout = options.timeout ? parseInt(options.timeout, 10) : 30000;

  console.log(chalk.blue(`Testing model: ${model}`));
  console.log(chalk.gray(`Prompt: "${prompt}"`));
  console.log(chalk.gray(`Iterations: ${iterations}`));
  console.log("");

  const results: Array<{ iteration: number; latencyMs: number; tokens: number; success: boolean }> = [];

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          model,
          temperature: 0.7,
          maxTokens: 100,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorBody = await response.text();
        results.push({ iteration: i + 1, latencyMs: Date.now() - start, tokens: 0, success: false });
        console.log(chalk.red(`  Iteration ${i + 1}: FAILED (${response.status}) - ${errorBody}`));
        continue;
      }

      const result = (await response.json()) as { content?: string; usage?: { totalTokens?: number } };
      const latencyMs = Date.now() - start;
      const tokens = result.usage?.totalTokens ?? 0;
      results.push({ iteration: i + 1, latencyMs, tokens, success: true });
      console.log(chalk.green(`  Iteration ${i + 1}: OK (${latencyMs}ms, ${tokens} tokens)`));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ iteration: i + 1, latencyMs: Date.now() - start, tokens: 0, success: false });
      console.log(chalk.red(`  Iteration ${i + 1}: ERROR - ${message}`));
    }
  }

  const successful = results.filter((r) => r.success);
  if (successful.length > 0) {
    const avgLatency = successful.reduce((sum, r) => sum + r.latencyMs, 0) / successful.length;
    const avgTokens = successful.reduce((sum, r) => sum + r.tokens, 0) / successful.length;
    console.log("");
    console.log(chalk.blue("Summary:"));
    console.log(`  Success rate: ${((successful.length / results.length) * 100).toFixed(1)}%`);
    console.log(`  Average latency: ${avgLatency.toFixed(0)}ms`);
    console.log(`  Average tokens: ${avgTokens.toFixed(0)}`);
  }
}

async function handleModelBenchmark(model: string, options: ModelBenchmarkOptions): Promise<void> {
  const knownModels = Object.keys(MODEL_CAPABILITIES);
  if (!knownModels.includes(model)) {
    console.error(chalk.red(`Unknown model: ${model}`));
    process.exit(1);
  }

  const config = await resolveConfig();
  const baseUrl = `http://localhost:${config.port || 7529}/api/v1`;
  const iterations = options.iterations ? parseInt(options.iterations, 10) : 5;
  const warmup = options.warmup ? parseInt(options.warmup, 10) : 1;
  const concurrent = options.concurrent ? parseInt(options.concurrent, 10) : 1;
  const promptLength = options.promptLength ? parseInt(options.promptLength, 10) : 100;

  const prompt = "A".repeat(promptLength);

  console.log(chalk.blue(`Benchmarking model: ${model}`));
  console.log(chalk.gray(`Iterations: ${iterations}, Warmup: ${warmup}, Concurrent: ${concurrent}`));
  console.log("");

  for (let i = 0; i < warmup; i++) {
    try {
      await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "warmup" }],
          model,
          temperature: 0.7,
          maxTokens: 10,
          stream: false,
        }),
      });
    } catch {
      continue;
    }
  }

  const latencies: number[] = [];
  const tokenCounts: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const batchStart = Date.now();
    const promises: Promise<{ latency: number; tokens: number }>[] = [];

    for (let j = 0; j < concurrent; j++) {
      promises.push(
        (async () => {
          const start = Date.now();
          try {
            const response = await fetch(`${baseUrl}/chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messages: [{ role: "user", content: prompt }],
                model,
                temperature: 0.7,
                maxTokens: 100,
                stream: false,
              }),
            });
            const result = (await response.json()) as { usage?: { totalTokens?: number } };
            return { latency: Date.now() - start, tokens: result.usage?.totalTokens ?? 0 };
          } catch {
            return { latency: Date.now() - start, tokens: 0 };
          }
        })()
      );
    }

    const batchResults = await Promise.all(promises);
    const batchLatency = Date.now() - batchStart;
    latencies.push(batchLatency);
    tokenCounts.push(batchResults.reduce((sum, r) => sum + r.tokens, 0));
    console.log(chalk.gray(`  Batch ${i + 1}: ${batchLatency}ms`));
  }

  const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);
  const avgTokens = tokenCounts.reduce((sum, t) => sum + t, 0) / tokenCounts.length;
  const throughput = (avgTokens / avgLatency) * 1000;

  console.log("");
  console.log(chalk.blue("Benchmark Results:"));
  console.log(`  Avg latency: ${avgLatency.toFixed(0)}ms`);
  console.log(`  Min latency: ${minLatency}ms`);
  console.log(`  Max latency: ${maxLatency}ms`);
  console.log(`  Avg tokens: ${avgTokens.toFixed(0)}`);
  console.log(`  Throughput: ${throughput.toFixed(1)} tokens/sec`);
}

async function handleModelCost(options: ModelCostOptions): Promise<void> {
  const config = await resolveConfig();
  const baseUrl = `http://localhost:${config.port || 7529}/api/v1`;
  const period = options.period ?? "month";

  try {
    const response = await fetch(`${baseUrl}/llm-config/usage?period=${period}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch usage data (${response.status})`);
    }
    const usage = (await response.json()) as Array<{
      modelId: string;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      estimatedCostUsd: number;
    }>;

    const rows = usage.map((entry) => ({
      model: entry.modelId,
      promptTokens: entry.promptTokens.toLocaleString(),
      completionTokens: entry.completionTokens.toLocaleString(),
      totalTokens: entry.totalTokens.toLocaleString(),
      estimatedCost: `$${entry.estimatedCostUsd.toFixed(4)}`,
    }));

    const totalCost = usage.reduce((sum, u) => sum + u.estimatedCostUsd, 0);
    console.log(chalk.blue(`Cost breakdown for: ${period}`));
    formatOutput(rows, { format: options.format ?? "table", colorize: true });
    console.log(chalk.green(`Total estimated cost: $${totalCost.toFixed(4)}`));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Error fetching cost data: ${message}`));

    const allModels = Object.entries(MODEL_PRICING) as [ModelId, (typeof MODEL_PRICING)[ModelId]][];
    const rows = allModels.map(([id, pricing]) => ({
      model: id,
      inputPer1K: `$${pricing.inputPer1K.toFixed(5)}`,
      outputPer1K: `$${pricing.outputPer1K.toFixed(5)}`,
      estimated1MInput: `$${(pricing.inputPer1K * 1000).toFixed(2)}`,
      estimated1MOutput: `$${(pricing.outputPer1K * 1000).toFixed(2)}`,
    }));
    console.log(chalk.gray("Pricing reference:"));
    formatOutput(rows, { format: options.format ?? "table", colorize: true });
  }
}

async function handleModelRecommend(options: ModelRecommendOptions): Promise<void> {
  const task = options.task ?? "general";
  const maxBudget = options.budget ? parseFloat(options.budget) : Infinity;
  const maxLatency = options.latency ? parseInt(options.latency, 10) : Infinity;
  const minContext = options.context ? parseInt(options.context, 10) : 0;

  const models = Object.entries(MODEL_CAPABILITIES) as [ModelId, (typeof MODEL_CAPABILITIES)[ModelId]][];
  const scored = models.map(([id, caps]) => {
    const pricing = MODEL_PRICING[id];
    let score = 0;

    if (task === "coding" || task === "code") {
      if (caps.supportsFunctionCalling) score += 30;
      if (caps.maxOutputTokens >= 8192) score += 20;
      if (caps.contextWindow >= 128000) score += 20;
    } else if (task === "analysis" || task === "reasoning") {
      if (caps.contextWindow >= 200000) score += 30;
      if (caps.maxOutputTokens >= 8192) score += 20;
      score += Math.min(caps.contextWindow / 10000, 20);
    } else if (task === "vision" || task === "image") {
      if (caps.supportsVision) score += 50;
      if (caps.contextWindow >= 128000) score += 20;
    } else if (task === "chat" || task === "conversation") {
      if (caps.supportsStreaming) score += 20;
      score += Math.min(caps.maxOutputTokens / 1000, 20);
    } else {
      score += 10;
    }

    const avgCost = (pricing.inputPer1K + pricing.outputPer1K) / 2;
    if (avgCost === 0) score += 15;
    else if (avgCost < 0.001) score += 10;
    else if (avgCost < 0.005) score += 5;

    if (pricing.inputPer1K * 1000 > maxBudget) score -= 50;
    if (caps.contextWindow < minContext) score -= 50;

    return { id, score: Math.max(score, 0), caps, pricing };
  });

  scored.sort((a, b) => b.score - a.score);

  const recommendations = scored.slice(0, 5).map((entry, index) => ({
    rank: index + 1,
    model: entry.id,
    score: entry.score,
    contextWindow: entry.caps.contextWindow.toLocaleString(),
    inputCost: `$${entry.pricing.inputPer1K.toFixed(5)}`,
    outputCost: `$${entry.pricing.outputPer1K.toFixed(5)}`,
    vision: entry.caps.supportsVision ? "yes" : "no",
    functionCalling: entry.caps.supportsFunctionCalling ? "yes" : "no",
  }));

  console.log(chalk.blue(`Model recommendations for task: ${task}`));
  formatOutput(recommendations, { format: "table", colorize: true });
}

export function registerModelCommand(program: Command): void {
  const model = program
    .command("model")
    .description("Manage and inspect LLM models");

  model
    .command("list")
    .description("List available models and capabilities")
    .option("-p, --provider <provider>", "filter by provider")
    .option("--capability <capability>", "filter by capability")
    .option("-f, --format <format>", "output format: json, table")
    .action(async (options: ModelListOptions) => {
      await handleModelList(options);
    });

  model
    .command("test")
    .description("Test a model with a prompt")
    .argument("<model>", "model identifier")
    .option("--prompt <text>", "test prompt")
    .option("-i, --iterations <number>", "number of test iterations")
    .option("--timeout <ms>", "request timeout in milliseconds")
    .action(async (modelId: string, options: ModelTestOptions) => {
      await handleModelTest(modelId, options);
    });

  model
    .command("benchmark")
    .description("Benchmark a model's performance")
    .argument("<model>", "model identifier")
    .option("-i, --iterations <number>", "number of iterations")
    .option("--warmup <number>", "warmup iterations")
    .option("-c, --concurrent <number>", "concurrent requests per iteration")
    .option("--prompt-length <chars>", "prompt length in characters")
    .action(async (modelId: string, options: ModelBenchmarkOptions) => {
      await handleModelBenchmark(modelId, options);
    });

  model
    .command("cost")
    .description("Show cost breakdown and pricing")
    .option("-p, --period <period>", "time period: day, week, month")
    .option("-f, --format <format>", "output format: json, table")
    .action(async (options: ModelCostOptions) => {
      await handleModelCost(options);
    });

  model
    .command("recommend")
    .description("Get model recommendations based on requirements")
    .option("-t, --task <type>", "task type: coding, analysis, vision, chat, general")
    .option("-b, --budget <usd>", "budget per 1M tokens in USD")
    .option("-l, --latency <ms>", "maximum acceptable latency")
    .option("--context <tokens>", "minimum context window size")
    .action(async (options: ModelRecommendOptions) => {
      await handleModelRecommend(options);
    });
}
