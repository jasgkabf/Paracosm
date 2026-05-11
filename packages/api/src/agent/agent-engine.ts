import { ToolRegistry, ToolExecutor, FileOperationsTool, ShellExecutorTool, WebSearchTool, CodeExecutorTool, ApiCallerTool, DataProcessorTool, SystemInfoTool } from '@paracosm/core';
import type { ToolDefinition, ToolExecutionContext } from '@paracosm/core/tools';
import { generateId, createLogger } from '@paracosm/shared';
import { ConfigStore } from './config-store.js';

const logger = createLogger('AgentEngine');

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface AgentResponse {
  id: string;
  content: string;
  toolCalls: ToolCallResult[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  timestamp: string;
}

export interface ToolCallResult {
  toolCallId: string;
  toolName: string;
  arguments: string;
  result: unknown;
  duration: number;
}

export interface OpenAIToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

const SYSTEM_PROMPT_TEMPLATE = `You are Paracosm, an intelligent AI agent. You have access to tools that let you interact with the real world - read files, execute commands, search the web, etc.

When a user asks you to do something that requires real-world interaction, use the appropriate tool. For example:
- If asked to list files or check folders, use the file_operations tool
- If asked to run a command, use the shell_executor tool
- If asked about system info, use the system_info tool

Always use tools when the task requires real-world interaction. Do not say "I cannot access your files" - instead, USE the tools available to you.

Available tools:
{tool_descriptions}`;

const MAX_TOOL_ROUNDS = 10;

export class AgentEngine {
  private configStore: ConfigStore;
  private toolRegistry: ToolRegistry;
  private toolExecutor: ToolExecutor;

  constructor(configStore: ConfigStore) {
    this.configStore = configStore;
    this.toolRegistry = new ToolRegistry();
    this.toolExecutor = new ToolExecutor(this.toolRegistry);
    this.registerBuiltinTools();
  }

  private registerBuiltinTools(): void {
    const tools: ToolDefinition[] = [
      FileOperationsTool.definition,
      ShellExecutorTool.definition,
      WebSearchTool.definition,
      CodeExecutorTool.definition,
      ApiCallerTool.definition,
      DataProcessorTool.definition,
      SystemInfoTool.definition,
    ];

    for (const tool of tools) {
      const result = this.toolRegistry.register(tool);
      if (!result.ok) {
        logger.warn(`Failed to register tool: ${tool.name}`, { error: result.err?.message });
      }
    }

    logger.info(`Registered ${this.toolRegistry.getCount()} builtin tools`);
  }

  reconfigureProvider(): void {
    logger.info('Provider reconfigured', { configured: this.configStore.isConfigured() });
  }

  isConfigured(): boolean {
    return this.configStore.isConfigured();
  }

  getConfigStore(): ConfigStore {
    return this.configStore;
  }

  private buildToolDefinitions(): OpenAIToolDefinition[] {
    const tools = this.toolRegistry.getAll();
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.id,
        description: tool.description,
        parameters: this.inferParameters(tool),
      },
    }));
  }

  private inferParameters(tool: ToolDefinition): { type: 'object'; properties: Record<string, unknown>; required?: string[] } {
    const paramMap: Record<string, Record<string, Record<string, unknown>>> = {
      file_operations: {
        operation: { type: 'string', enum: ['list', 'read', 'write', 'exists', 'stat'], description: 'The file operation to perform' },
        path: { type: 'string', description: 'The file or directory path' },
        content: { type: 'string', description: 'Content to write (for write operation)' },
      },
      shell_executor: {
        command: { type: 'string', description: 'The shell command to execute' },
        timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
      },
      web_search: {
        query: { type: 'string', description: 'The search query' },
        maxResults: { type: 'number', description: 'Maximum number of results (default: 10)' },
      },
      code_executor: {
        code: { type: 'string', description: 'The code to execute' },
        language: { type: 'string', description: 'Programming language (default: javascript)' },
      },
      api_caller: {
        url: { type: 'string', description: 'The URL to call' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], description: 'HTTP method (default: GET)' },
        headers: { type: 'object', description: 'Request headers' },
        body: { type: 'string', description: 'Request body (JSON string)' },
      },
      data_processor: {
        operation: { type: 'string', description: 'The data operation (transform, filter, aggregate, sort)' },
        data: { type: 'string', description: 'The input data' },
        options: { type: 'object', description: 'Operation options' },
      },
      system_info: {
        infoType: { type: 'string', enum: ['general', 'cpu', 'memory', 'disk', 'network'], description: 'Type of system info to retrieve (default: general)' },
      },
    };

    const properties = paramMap[tool.id] ?? { input: { type: 'string', description: 'Input for the tool' } };
    const required = Object.entries(properties)
      .filter(([, v]) => {
        const desc = v.description as string | undefined;
        return desc && !desc.includes('default');
      })
      .map(([k]) => k);

    return { type: 'object', properties, required };
  }

  private buildSystemPrompt(): string {
    const tools = this.toolRegistry.getAll();
    const descriptions = tools
      .map((t) => `- ${t.id}: ${t.description}`)
      .join('\n');
    return SYSTEM_PROMPT_TEMPLATE.replace('{tool_descriptions}', descriptions);
  }

  async processMessage(
    message: string,
    history: Array<{ role: string; content: string }> = [],
  ): Promise<AgentResponse> {
    if (!this.isConfigured()) {
      return {
        id: generateId(),
        content: 'LLM is not configured. Please configure your API key, base URL, and model via the /llm-config endpoint.',
        toolCalls: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        model: '',
        timestamp: new Date().toISOString(),
      };
    }

    const messages: AgentMessage[] = [
      { role: 'system', content: this.buildSystemPrompt() },
    ];

    for (const msg of history) {
      messages.push({ role: msg.role as AgentMessage['role'], content: msg.content });
    }

    messages.push({ role: 'user', content: message });

    return this.runAgentLoop(messages);
  }

  private async runAgentLoop(messages: AgentMessage[]): Promise<AgentResponse> {
    let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const allToolCalls: ToolCallResult[] = [];
    let lastContent = '';

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const rawBody = this.buildOpenAIRequestBody(messages);
      const response = await this.callLLM(rawBody);

      const choice = response.choices?.[0];
      if (!choice) {
        return {
          id: generateId(),
          content: 'No response from LLM',
          toolCalls: allToolCalls,
          usage: totalUsage,
          model: response.model ?? '',
          timestamp: new Date().toISOString(),
        };
      }

      if (response.usage) {
        totalUsage.promptTokens += response.usage.prompt_tokens ?? 0;
        totalUsage.completionTokens += response.usage.completion_tokens ?? 0;
        totalUsage.totalTokens += response.usage.total_tokens ?? 0;
      }

      const assistantMsg: AgentMessage = {
        role: 'assistant',
        content: choice.message?.content ?? '',
      };

      if (choice.message?.tool_calls && choice.message.tool_calls.length > 0) {
        assistantMsg.tool_calls = choice.message.tool_calls;
        messages.push(assistantMsg);

        for (const toolCall of choice.message.tool_calls) {
          const toolResult = await this.executeToolCall(toolCall);
          allToolCalls.push(toolResult);
          messages.push({
            role: 'tool',
            content: JSON.stringify(toolResult.result),
            tool_call_id: toolResult.toolCallId,
            name: toolResult.toolName,
          });
        }
      } else {
        lastContent = choice.message?.content ?? '';
        break;
      }
    }

    return {
      id: generateId(),
      content: lastContent,
      toolCalls: allToolCalls,
      usage: totalUsage,
      model: this.configStore.getRawConfig().model,
      timestamp: new Date().toISOString(),
    };
  }

  private buildOpenAIRequestBody(messages: AgentMessage[]): Record<string, unknown> {
    const config = this.configStore.getRawConfig();
    const tools = this.buildToolDefinitions();
    const openaiMessages: Array<Record<string, unknown>> = messages.map((m) => {
      const msg: Record<string, unknown> = { role: m.role, content: m.content };
      if (m.tool_calls) msg.tool_calls = m.tool_calls;
      if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
      if (m.name) msg.name = m.name;
      return msg;
    });

    return {
      model: config.model,
      messages: openaiMessages,
      tools,
      temperature: 0.7,
      max_tokens: 4096,
    };
  }

  private async callLLM(body: Record<string, unknown>): Promise<OpenAIChatResponse> {
    const config = this.configStore.getRawConfig();
    const url = `${config.baseUrl}/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`LLM API error ${response.status}: ${errorBody.slice(0, 500)}`);
      }

      return await response.json() as OpenAIChatResponse;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async executeToolCall(toolCall: ToolCall): Promise<ToolCallResult> {
    const toolName = toolCall.function.name;
    const startTime = Date.now();

    let args: unknown;
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch {
      args = { raw: toolCall.function.arguments };
    }

    const context: ToolExecutionContext = {
      sessionId: 'default',
      userId: 'default',
      permissions: [],
      timeout: 30000,
      environment: {},
      metadata: {},
    };

    const result = await this.toolExecutor.execute(toolName, args, context);
    const duration = Date.now() - startTime;

    if (result.ok) {
      return {
        toolCallId: toolCall.id,
        toolName,
        arguments: toolCall.function.arguments,
        result: result.value.output,
        duration,
      };
    } else {
      return {
        toolCallId: toolCall.id,
        toolName,
        arguments: toolCall.function.arguments,
        result: { error: result.err.message },
        duration,
      };
    }
  }

  async *streamMessage(
    message: string,
    history: Array<{ role: string; content: string }> = [],
  ): AsyncGenerator<StreamEvent> {
    if (!this.isConfigured()) {
      yield { type: 'error', data: 'LLM is not configured' };
      return;
    }

    const messages: AgentMessage[] = [
      { role: 'system', content: this.buildSystemPrompt() },
    ];

    for (const msg of history) {
      messages.push({ role: msg.role as AgentMessage['role'], content: msg.content });
    }

    messages.push({ role: 'user', content: message });

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const rawBody = this.buildOpenAIRequestBody(messages);
      rawBody.stream = true;

      const streamResult = await this.callLLMStream(rawBody);

      if (streamResult.type === 'tool_calls' && streamResult.toolCalls) {
        const assistantMsg: AgentMessage = {
          role: 'assistant',
          content: streamResult.content ?? '',
          tool_calls: streamResult.toolCalls,
        };
        messages.push(assistantMsg);

        for (const toolCall of streamResult.toolCalls) {
          yield { type: 'tool_call', data: { id: toolCall.id, name: toolCall.function.name, arguments: toolCall.function.arguments } };

          const toolResult = await this.executeToolCall(toolCall);
          yield { type: 'tool_result', data: { id: toolCall.id, name: toolResult.toolName, result: toolResult.result, duration: toolResult.duration } };

          messages.push({
            role: 'tool',
            content: JSON.stringify(toolResult.result),
            tool_call_id: toolResult.toolCallId,
            name: toolResult.toolName,
          });
        }
      } else {
        for (const token of streamResult.tokens) {
          yield { type: 'token', data: token };
        }
        return;
      }
    }
  }

  private async callLLMStream(body: Record<string, unknown>): Promise<StreamAccumulatedResult> {
    const config = this.configStore.getRawConfig();
    const url = `${config.baseUrl}/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`LLM API error ${response.status}: ${errorBody.slice(0, 500)}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body for streaming');

      const decoder = new TextDecoder();
      let buffer = '';
      let content = '';
      const tokens: string[] = [];
      const toolCalls: ToolCall[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (!trimmed.startsWith('data: ')) continue;

            try {
              const chunk = JSON.parse(trimmed.slice(6));
              const choice = chunk.choices?.[0];
              if (!choice) continue;

              const delta = choice.delta;
              if (delta?.content) {
                content += delta.content;
                tokens.push(delta.content);
              }

              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0;
                  if (idx >= toolCalls.length) {
                    toolCalls.push({
                      id: tc.id ?? `tc_${idx}`,
                      type: 'function',
                      function: { name: '', arguments: '' },
                    });
                  }
                  if (tc.id) toolCalls[idx].id = tc.id;
                  if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
                  if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
                }
              }

              if (choice.finish_reason === 'tool_calls' || (toolCalls.length > 0 && choice.finish_reason === 'stop')) {
                return { type: 'tool_calls', content, toolCalls, tokens };
              }
            } catch {
              continue;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (toolCalls.length > 0) {
        return { type: 'tool_calls', content, toolCalls, tokens };
      }

      return { type: 'content', content, tokens };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export interface StreamEvent {
  type: 'token' | 'tool_call' | 'tool_result' | 'error';
  data: unknown;
}

interface StreamAccumulatedResult {
  type: 'content' | 'tool_calls';
  content: string;
  tokens: string[];
  toolCalls?: ToolCall[];
}

interface OpenAIChatResponse {
  id: string;
  model?: string;
  choices: Array<{
    index: number;
    message?: {
      role: string;
      content?: string;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
