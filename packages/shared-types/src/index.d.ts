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
export interface UserDto {
    id: string;
    email: string;
    createdAt: string;
}
export type TransactionType = 'debit' | 'credit';
export type TransactionCategory = 'food' | 'travel' | 'utilities' | 'entertainment' | 'health' | 'shopping' | 'subscriptions' | 'income' | 'other';
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
export interface InsightDto {
    id: string;
    userId: string;
    weekStart: string;
    summaryJson: AiRecommendation;
    createdAt: string;
}
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
export interface CsvImportResult {
    inserted: number;
    skipped: number;
    failed: number;
    errors: Array<{
        row: number;
        message: string;
    }>;
    /** BullMQ job IDs for SSE progress tracking: [embed, subscriptions, insights] */
    jobIds?: string[];
}
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
//# sourceMappingURL=index.d.ts.map