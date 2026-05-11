import type { TemplateDefinition } from '../template-engine.js';

export const OllamaLocalTemplate: TemplateDefinition = {
  id: 'ollama-local',
  name: 'Ollama Local',
  requestMapping: {
    promptField: 'messages.1.content',
    systemPromptField: 'messages.0.content',
    modelField: 'model',
    temperatureField: 'options.temperature',
    maxTokensField: 'options.num_predict',
    topPField: 'options.top_p',
    stopSequencesField: '',
    extraFields: {},
  },
  responseMapping: {
    contentField: 'message.content',
    modelField: 'model',
    finishReasonField: 'done',
    usageField: '',
    promptTokensField: 'prompt_eval_count',
    completionTokensField: 'eval_count',
    totalTokensField: '',
    errorField: 'error',
    errorMessageField: 'error',
  },
  streamMapping: {
    contentField: 'message.content',
    finishReasonField: 'done',
  },
  capabilities: {
    streaming: true,
    functionCalling: false,
    vision: false,
    audio: false,
    embeddings: true,
    maxContextTokens: 32768,
    maxOutputTokens: 4096,
    supportedLanguages: ['en'],
  },
  baseUrl: 'http://localhost:11434/v1',
  headers: {
    'Content-Type': 'application/json',
  },
};
