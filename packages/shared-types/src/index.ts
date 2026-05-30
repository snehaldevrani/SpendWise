// Auth
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

// User
export interface UserDto {
  id: string;
  email: string;
  createdAt: string;
}

// Transaction
export type TransactionType = 'debit' | 'credit';

export type TransactionCategory =
  | 'food'
  | 'travel'
  | 'utilities'
  | 'entertainment'
  | 'health'
  | 'shopping'
  | 'subscriptions'
  | 'income'
  | 'other';

export interface TransactionDto {
  id: string;
  userId: string;
  date: string;
  merchant: string;
  amount: number;
  currency: string;
  category: TransactionCategory;
  type: TransactionType;
  rawText: string;
}

// Subscription
export interface SubscriptionDto {
  id: string;
  userId: string;
  merchant: string;
  estimatedCycleDays: number;
  avgAmount: number;
  confidenceScore: number;
  lastChargeDate: string;
  nextExpectedDate: string;
}

// Insight
export interface InsightDto {
  id: string;
  userId: string;
  weekStart: string;
  summaryJson: AiRecommendation;
  createdAt: string;
}

// AI
export interface SpendLeak {
  merchant: string;
  reason: string;
  estimatedMonthlySavings: number;
}

export interface AiRecommendation {
  topLeaks: SpendLeak[];
  estimatedMonthlySavings: number;
  actionChecklist: string[];
  uncertaintyNotes: string;
}

// Upload result
export interface CsvImportResult {
  inserted: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

// Monthly summary
export interface CategoryBreakdown {
  category: TransactionCategory;
  total: number;
  count: number;
}

export interface MonthlySummary {
  month: number;
  year: number;
  total: number;
  breakdown: CategoryBreakdown[];
}
