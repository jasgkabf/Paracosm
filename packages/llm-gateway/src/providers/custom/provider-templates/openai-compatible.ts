import type { TemplateDefinition } from '../template-engine.js';

export const OpenAICompatibleTemplate: TemplateDefinition = {
  id: 'openai-compatible',
  name: 'OpenAI Compatible',
  requestMapping: {
    promptField: 'messages.1.content',
    systemPromptField: 'messages.0.content',
    modelField: 'model',
    temperatureField: 'temperature',
    maxTokensField: 'max_tokens',
    topPField: 'top_p',
    stopSequencesField: 'stop',
    extraFields: {},
  },
  responseMapping: {
    contentField: 'choices.0.message.content',
    modelField: 'model',
    finishReasonField: 'choices.0.finish_reason',
    usageField: 'usage',
    promptTokensField: 'prompt_tokens',
    completionTokensField: 'completion_tokens',
    totalTokensField: 'total_tokens',
    errorField: 'error',
    errorMessageField: 'error.message',
  },
  streamMapping: {
    contentField: 'choices.0.delta.content',
    finishReasonField: 'choices.0.finish_reason',
  },
  capabilities: {
    streaming: true,
    functionCalling: true,
    vision: true,
    audio: false,
    embeddings: true,
    maxContextTokens: 128000,
    maxOutputTokens: 4096,
    supportedLanguages: ['en'],
  },
  headers: {
    'Content-Type': 'application/json',
  },
};
