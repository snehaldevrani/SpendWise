'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

// ─── Chat ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  actionsPerformed?: string[];
}

const GREETING: ChatMessage = {
  id: 0,
  role: 'assistant',
  content: "Hi! I'm your SpendWise AI. Ask me anything about your spending — I analyse your real transaction history to give you personalised answers.",
};

interface ChatState {
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  clearHistory: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [GREETING],
      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      clearHistory: () => set({ messages: [GREETING] }),
    }),
    {
      name: 'chat-store',
      partialize: (s) => ({ messages: s.messages }),
      storage: typeof window !== 'undefined'
        ? { getItem: (k) => sessionStorage.getItem(k), setItem: (k, v) => sessionStorage.setItem(k, v), removeItem: (k) => sessionStorage.removeItem(k) }
        : undefined,
    },
  ),
);

// ─── Auth ─────────────────────────────────────────────────────────────────────

interface AuthState {
  user: { id: string; email: string } | null;
  setUser: (user: { id: string; email: string }) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: () => {
        set({ user: null });
        // Clear persisted chat history so one user's data doesn't linger for the next
        useChatStore.getState().clearHistory();
      },
      isAuthenticated: () => !!get().user,
    }),
    {
      name: 'auth-store',
      partialize: (s) => ({ user: s.user }),
      storage: typeof window !== 'undefined'
        ? { getItem: (k) => sessionStorage.getItem(k), setItem: (k, v) => sessionStorage.setItem(k, v), removeItem: (k) => sessionStorage.removeItem(k) }
        : undefined,
    },
  ),
);

interface TransactionFilters {
  startDate: string | null;
  endDate: string | null;
  categories: string[];
  search: string;
  page: number;
  sortBy: 'date' | 'amount';
  sortDir: 'asc' | 'desc';
  setFilter: <K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]) => void;
  reset: () => void;
}

export const useTransactionFilters = create<TransactionFilters>((set) => ({
  startDate: null,
  endDate: null,
  categories: [],
  search: '',
  page: 1,
  sortBy: 'date',
  sortDir: 'desc',
  setFilter: (key, value) => set((s) => ({ ...s, [key]: value })),
  reset: () => set({ startDate: null, endDate: null, categories: [], search: '', page: 1, sortBy: 'date', sortDir: 'desc' }),
}));

interface UIState {
  sidebarCollapsed: boolean;
  uploadDialogOpen: boolean;
  toggleSidebar: () => void;
  setUploadDialog: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  uploadDialogOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setUploadDialog: (open) => set({ uploadDialogOpen: open }),
}));
