import { create } from "zustand";
import type { ChatMessage, ToolCall } from "@/types/chat";

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;

  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setStreaming: (streaming: boolean) => void;
  appendStreamContent: (text: string) => void;
  resetStreamContent: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  streamingContent: "",

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setMessages: (messages) => set({ messages }),

  setStreaming: (isStreaming) => set({ isStreaming }),

  appendStreamContent: (text) =>
    set((state) => ({ streamingContent: state.streamingContent + text })),

  resetStreamContent: () => set({ streamingContent: "" }),
}));
