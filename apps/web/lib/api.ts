import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
  withCredentials: true,
});

// Track whether a token refresh is in progress to prevent race conditions
let refreshPromise: Promise<void> | null = null;

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      // Queue concurrent 401s behind a single refresh call
      if (!refreshPromise) {
        refreshPromise = axios
          .post(
            `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'}/auth/refresh`,
            {},
            { withCredentials: true },
          )
          .then(() => {
            refreshPromise = null;
          })
          .catch((err) => {
            refreshPromise = null;
            throw err;
          });
      }

      try {
        await refreshPromise;
        return api(original);
      } catch {
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// ─── Typed response helpers ───────────────────────────────────────────────────

export interface OverviewData {
  current: { total: number; totalIncome: number; savings: number; breakdown: Array<{ category: string; total: number; count: number }> };
  previous: { total: number; totalIncome: number; savings: number };
  latestMonth: number;
  latestYear: number;
}

export interface DailySpend { date: string; amount: number }

export interface Transaction {
  id: string;
  date: string;
  merchant: string;
  amount: string;
  currency: string;
  category: string;
  type: 'debit' | 'credit';
}

export interface TransactionsPage {
  total: number;
  page: number;
  limit: number;
  items: Transaction[];
}

export interface Subscription {
  id: string;
  merchant: string;
  estimatedCycleDays: number;
  avgAmount: string;
  confidenceScore: number;
  lastChargeDate: string;
  nextExpectedDate: string;
  dismissed: boolean;
  confirmed: boolean;
  annualCost?: number;
  isLikelyUnused?: boolean;
}

export interface Insight {
  id: string;
  weekStart: string;
  summaryJson: {
    totalSpend: number;
    totalIncome: number;
    byCategory: Record<string, number>;
    topMerchants: Array<{ merchant: string; total: number }>;
  };
}

export interface AiRecommendation {
  topLeaks: Array<{ merchant: string; reason: string; estimatedMonthlySavings: number }>;
  estimatedMonthlySavings: number;
  actionChecklist: string[];
  uncertaintyNotes: string;
}

export interface UserPreferences {
  weeklyEmail: boolean;
  newSubAlert: boolean;
  spikeAlert: boolean;
  timezone: string;
}

export type BudgetStatus = 'ok' | 'warning' | 'over';

export interface BudgetItem {
  id: string;
  category: string;
  limitAmount: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  forecast: number;
  status: BudgetStatus;
  month: number;
  year: number;
  recurring: boolean;
}

export interface BudgetSummary {
  items: BudgetItem[];
  totalLimit: number;
  totalSpent: number;
  overBudget: number;
  healthScore: number;
}

export type CategoryTrendsRow = { month: string } & Record<string, number>;

export interface RangeOverview {
  totalDebit: number;
  totalIncome: number;
  savings: number;
  breakdown: Array<{ category: string; total: number }>;
  start: string;
  end: string;
}

