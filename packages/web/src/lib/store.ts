import { create } from 'zustand';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  persona?: string;
  model?: string;
  toolName?: string;
  toolResult?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  selectedPersona: string;
}

interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface AppState extends ChatState {
  addMessage: (msg: ChatMessage) => void;
  setStreaming: (streaming: boolean) => void;
  setSelectedPersona: (persona: string) => void;
  clearMessages: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  locale: 'en' | 'zh';
  setLocale: (locale: 'en' | 'zh') => void;
  llmConfig: LlmConfig | null;
  setLlmConfig: (config: LlmConfig | null) => void;
}

export const useStore = create<AppState>((set) => ({
  messages: [],
  isStreaming: false,
  selectedPersona: 'default',
  sidebarOpen: true,
  locale: 'en',
  llmConfig: null,

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  setSelectedPersona: (persona) => set({ selectedPersona: persona }),

  clearMessages: () => set({ messages: [] }),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setLocale: (locale) => set({ locale }),

  setLlmConfig: (config) => set({ llmConfig: config }),
}));
