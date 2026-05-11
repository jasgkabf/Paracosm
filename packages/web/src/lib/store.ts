import { create } from 'zustand';

interface ChatState {
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    persona?: string;
    model?: string;
  }>;
  isStreaming: boolean;
  selectedPersona: string;
}

interface AppState extends ChatState {
  addMessage: (msg: ChatState['messages'][0]) => void;
  setStreaming: (streaming: boolean) => void;
  setSelectedPersona: (persona: string) => void;
  clearMessages: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  messages: [],
  isStreaming: false,
  selectedPersona: 'default',
  sidebarOpen: true,

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  setSelectedPersona: (persona) => set({ selectedPersona: persona }),

  clearMessages: () => set({ messages: [] }),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
