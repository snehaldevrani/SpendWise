'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

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
      },
      isAuthenticated: () => !!get().user,
    }),
    { name: 'auth-store', partialize: (s) => ({ user: s.user }) },
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
