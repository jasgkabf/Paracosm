import type { TemplateDefinition } from '../template-engine.js';

export const AnthropicFormatTemplate: TemplateDefinition = {
  id: 'anthropic-format',
  name: 'Anthropic Format',
  requestMapping: {
    promptField: 'messages.0.content',
    systemPromptField: 'system',
    modelField: 'model',
    temperatureField: 'temperature',
    maxTokensField: 'max_tokens',
    topPField: 'top_p',
    stopSequencesField: 'stop_sequences',
    extraFields: {},
  },
  responseMapping: {
    contentField: 'content.0.text',
    modelField: 'model',
    finishReasonField: 'stop_reason',
    usageField: 'usage',
    promptTokensField: 'input_tokens',
    completionTokensField: 'output_tokens',
    totalTokensField: '',
    errorField: 'error',
    errorMessageField: 'error.message',
  },
  streamMapping: {
    contentField: 'delta.text',
    finishReasonField: 'delta.stop_reason',
  },
  capabilities: {
    streaming: true,
    functionCalling: true,
    vision: true,
    audio: false,
    embeddings: false,
    maxContextTokens: 200000,
    maxOutputTokens: 8192,
    supportedLanguages: ['en'],
  },
  headers: {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  },
};
