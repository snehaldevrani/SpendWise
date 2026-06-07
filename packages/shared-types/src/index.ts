// Auth
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
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

export type TransactionCategory = string;

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

// Custom Category
export interface CustomCategoryDto {
  id: string;
  userId: string;
  name: string;
  slug: string;
  merchants: string[];
  emoji?: string | null;
  color?: string | null;
  createdAt: string;
  updatedAt: string;
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
  /** BullMQ job IDs for SSE progress tracking: [embed, subscriptions, insights] */
  jobIds?: string[];
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
