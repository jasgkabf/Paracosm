import { create } from "zustand";

interface ChatState {
  conversations: Array<{
    id: string;
    title: string;
    lastMessage: string;
    timestamp: number;
  }>;
  activeConversationId: string | null;
  isStreaming: boolean;
}

interface AppState {
  sidebarCollapsed: boolean;
  theme: "dark" | "light";
  chat: ChatState;

  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: "dark" | "light") => void;
  setActiveConversation: (id: string | null) => void;
  setIsStreaming: (streaming: boolean) => void;
  addConversation: (conversation: { id: string; title: string; lastMessage: string }) => void;
  removeConversation: (id: string) => void;
}

export const useStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  theme: "dark",
  chat: {
    conversations: [],
    activeConversationId: null,
    isStreaming: false,
  },

  setSidebarCollapsed: (collapsed) =>
    set((state) => ({ sidebarCollapsed: collapsed })),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setTheme: (theme) => set({ theme }),

  setActiveConversation: (id) =>
    set((state) => ({
      chat: { ...state.chat, activeConversationId: id },
    })),

  setIsStreaming: (streaming) =>
    set((state) => ({
      chat: { ...state.chat, isStreaming: streaming },
    })),

  addConversation: (conversation) =>
    set((state) => ({
      chat: {
        ...state.chat,
        conversations: [
          { ...conversation, timestamp: Date.now() },
          ...state.chat.conversations,
        ],
      },
    })),

  removeConversation: (id) =>
    set((state) => ({
      chat: {
        ...state.chat,
        conversations: state.chat.conversations.filter((c) => c.id !== id),
        activeConversationId:
          state.chat.activeConversationId === id
            ? null
            : state.chat.activeConversationId,
      },
    })),
}));
