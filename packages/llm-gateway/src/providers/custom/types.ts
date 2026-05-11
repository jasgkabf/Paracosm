export interface CustomProviderTypes {
  RequestMapping: {
    promptField: string;
    systemPromptField: string;
    modelField: string;
    temperatureField: string;
    maxTokensField: string;
    topPField: string;
    stopSequencesField: string;
    extraFields: Record<string, unknown>;
  };
  ResponseMapping: {
    contentField: string;
    modelField: string;
    finishReasonField: string;
    usageField: string;
    promptTokensField: string;
    completionTokensField: string;
    totalTokensField: string;
    errorField: string;
    errorMessageField: string;
  };
  StreamMapping: {
    eventField: string;
    contentField: string;
    finishReasonField: string;
    usageField: string;
    doneSignal: string;
    dataPrefix: string;
  };
  ProviderTemplateConfig: {
    id: string;
    name: string;
    provider: string;
    requestMapping: CustomProviderTypes['RequestMapping'];
    responseMapping: CustomProviderTypes['ResponseMapping'];
    streamMapping: CustomProviderTypes['StreamMapping'];
    capabilities: {
      streaming: boolean;
      functionCalling: boolean;
      vision: boolean;
      audio: boolean;
      embeddings: boolean;
      maxContextTokens: number;
      maxOutputTokens: number;
      supportedLanguages: string[];
    };
    metadata: Record<string, unknown>;
  };
}
