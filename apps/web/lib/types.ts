export interface AiRecommendation {
  topLeaks: Array<{ merchant: string; reason: string; estimatedMonthlySavings: number }>;
  estimatedMonthlySavings: number;
  actionChecklist: string[];
  uncertaintyNotes: string;
}

export interface Transaction {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  currency: string;
  category: string;
  type: 'debit' | 'credit';
}

export interface Subscription {
  id: string;
  merchant: string;
  estimatedCycleDays: number;
  avgAmount: number;
  confidenceScore: number;
  lastChargeDate: string;
  nextExpectedDate: string;
  dismissed: boolean;
  confirmed: boolean;
  annualCost?: number;
  isLikelyUnused?: boolean;
}

export interface MonthlySummary {
  month: number;
  year: number;
  total: number;
  totalIncome: number;
  savings: number;
  breakdown: Array<{ category: string; total: number; count: number }>;
}

export interface CsvImportResult {
  inserted: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}
