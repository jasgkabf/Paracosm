import type { TemplateDefinition } from '../template-engine.js';

export const RawHTTPTemplate: TemplateDefinition = {
  id: 'raw-http',
  name: 'Raw HTTP',
  requestMapping: {
    promptField: 'prompt',
    systemPromptField: 'system_prompt',
    modelField: 'model',
    temperatureField: 'temperature',
    maxTokensField: 'max_tokens',
    topPField: 'top_p',
    stopSequencesField: 'stop',
    extraFields: {},
  },
  responseMapping: {
    contentField: 'text',
    modelField: 'model',
    finishReasonField: 'finish_reason',
    usageField: 'usage',
    promptTokensField: 'prompt_tokens',
    completionTokensField: 'completion_tokens',
    totalTokensField: 'total_tokens',
    errorField: 'error',
    errorMessageField: 'error.message',
  },
  streamMapping: {
    contentField: 'text',
    finishReasonField: 'finish_reason',
  },
  capabilities: {
    streaming: false,
    functionCalling: false,
    vision: false,
    audio: false,
    embeddings: false,
    maxContextTokens: 4096,
    maxOutputTokens: 4096,
    supportedLanguages: ['en'],
  },
  headers: {
    'Content-Type': 'application/json',
  },
};
