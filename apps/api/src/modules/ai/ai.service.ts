import { Injectable, ServiceUnavailableException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AiRecommendation } from '@spendwise/shared-types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';

const RECOMMENDATIONS_TTL = 6 * 60 * 60; // 6 hours
const CHAT_RATE_LIMIT = 20;               // messages per day
const RECS_RATE_LIMIT = 4;               // recommendations per day
const RATE_WINDOW = 24 * 60 * 60;        // 24 hours

@Injectable()
export class AiService {
  private client: Anthropic;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private cache: CacheService,
  ) {
    this.client = new Anthropic({ apiKey: this.config.get('ANTHROPIC_API_KEY') });
  }

  async getRecommendations(userId: string): Promise<AiRecommendation> {
    // Per-user rate limit
    const rateLimitKey = `ai:recs:rate:${userId}`;
    const count = await this.cache.incr(rateLimitKey, RATE_WINDOW);
    if (count > RECS_RATE_LIMIT) {
      throw new HttpException('AI recommendation limit reached for today. Try again tomorrow.', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Cache hit
    const cacheKey = `ai:recs:${userId}`;
    const cached = await this.cache.get<AiRecommendation>(cacheKey);
    if (cached) return cached;

    const stats = await this.buildUserStats(userId);

    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `You are a personal finance advisor. Analyze the user's spending data and return actionable insights.
Rules:
- Provide suggestions, not investment advice or guaranteed outcomes
- Show reasoning based only on the provided data
- If data is insufficient, say so in uncertaintyNotes
- Be specific with merchant names from the data
- Return valid JSON only, no markdown`,
      messages: [
        {
          role: 'user',
          content: `Analyze this user's financial data and return a JSON object with this exact schema:
{
  "topLeaks": [
    { "merchant": "string", "reason": "string", "estimatedMonthlySavings": number }
  ],
  "estimatedMonthlySavings": number,
  "actionChecklist": ["string", "string", "string", "string", "string"],
  "uncertaintyNotes": "string"
}

User data:
${JSON.stringify(stats, null, 2)}

Return ONLY the JSON object, no explanation.`,
        },
      ],
    });

    const raw = message.content[0];
    if (raw.type !== 'text') throw new ServiceUnavailableException('Unexpected AI response type');

    // Strip markdown fences if Claude wraps the JSON
    const jsonText = raw.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    try {
      const parsed = JSON.parse(jsonText) as AiRecommendation;
      this.validateRecommendation(parsed);
      // Store in cache
      await this.cache.set(cacheKey, parsed, RECOMMENDATIONS_TTL);
      return parsed;
    } catch (err) {
      throw new ServiceUnavailableException(`AI returned malformed response: ${(err as Error).message}`);
    }
  }

  /** Call after a successful upload to bust the recommendations cache */
  async bustRecommendationsCache(userId: string): Promise<void> {
    await this.cache.del(`ai:recs:${userId}`);
  }

  async chat(userId: string, question: string, contextChunks: string[]): Promise<string> {
    // Per-user rate limit
    const rateLimitKey = `ai:chat:rate:${userId}`;
    const count = await this.cache.incr(rateLimitKey, RATE_WINDOW);
    if (count > CHAT_RATE_LIMIT) {
      throw new HttpException('AI chat limit reached for today. Try again tomorrow.', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Always fetch ALL transactions for factual accuracy.
    // Semantic RAG alone cannot answer aggregate/numeric queries (largest, total, count)
    // because it returns semantically similar chunks, not sorted-by-amount ones.
    const allTxns = await this.prisma.transaction.findMany({
      where: { userId },
      select: { merchant: true, amount: true, category: true, date: true, type: true },
      orderBy: [{ amount: 'desc' }, { date: 'desc' }],
    });

    let structuredContext = '';
    if (allTxns.length > 0) {
      const debits = allTxns.filter((t) => t.type === 'debit');
      const credits = allTxns.filter((t) => t.type === 'credit');
      const totalDebit = debits.reduce((s, t) => s + Number(t.amount), 0);
      const totalCredit = credits.reduce((s, t) => s + Number(t.amount), 0);

      const categoryTotals: Record<string, number> = {};
      for (const t of debits) {
        categoryTotals[t.category] = (categoryTotals[t.category] ?? 0) + Number(t.amount);
      }
      const categorySummary = Object.entries(categoryTotals)
        .sort(([, a], [, b]) => b - a)
        .map(([c, a]) => `${c} ₹${a.toFixed(2)}`)
        .join(', ');

      const txnLines = allTxns
        .map((t) => `  ${new Date(t.date).toISOString().slice(0, 10)}: ${t.merchant} (${t.category}) ₹${Number(t.amount).toFixed(2)} [${t.type}]`)
        .join('\n');

      structuredContext = `COMPLETE TRANSACTION LIST (all ${allTxns.length} transactions, sorted by amount desc):
Summary: ₹${totalDebit.toFixed(2)} total debits (${debits.length} txns), ₹${totalCredit.toFixed(2)} total credits (${credits.length} txns)
By category (debits): ${categorySummary}
Largest single debit: ${debits[0] ? `${debits[0].merchant} ₹${Number(debits[0].amount).toFixed(2)} on ${new Date(debits[0].date).toISOString().slice(0, 10)}` : 'none'}

Transactions:
${txnLines}`;
    }

    const ragContext = contextChunks.length > 0
      ? `\nAdditional semantic matches:\n${contextChunks.join('\n')}`
      : '';

    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `You are a personal finance assistant. Answer questions about the user's spending using ONLY the provided transaction data.
The COMPLETE TRANSACTION LIST contains every transaction — use it for all factual queries (largest, total, count, by category, etc.).
Be concise and accurate. Never guess or approximate when the exact data is present.`,
      messages: [
        {
          role: 'user',
          content: `${structuredContext}${ragContext}\n\nQuestion: ${question}`,
        },
      ],
    });

    const raw = message.content[0];
    if (raw.type !== 'text') throw new ServiceUnavailableException('Unexpected AI response');
    return raw.text;
  }

  private async buildUserStats(userId: string) {
    const [recentTransactions, subscriptions] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId, type: 'debit' },
        select: { merchant: true, amount: true, category: true, date: true },
        orderBy: { amount: 'desc' },
      }),
      this.prisma.subscription.findMany({
        where: { userId, dismissed: false },
        select: { merchant: true, avgAmount: true, estimatedCycleDays: true, confidenceScore: true },
      }),
    ]);

    const categoryTotals: Record<string, number> = {};
    let monthlyTotal = 0;
    for (const t of recentTransactions) {
      const amt = Number(t.amount);
      categoryTotals[t.category] = (categoryTotals[t.category] ?? 0) + amt;
      monthlyTotal += amt;
    }

    const topMerchants = recentTransactions
      .reduce<Record<string, number>>((acc, t) => {
        acc[t.merchant] = (acc[t.merchant] ?? 0) + Number(t.amount);
        return acc;
      }, {});

    return {
      period: 'all time',
      totalSpend: Math.round(monthlyTotal * 100) / 100,
      categoryBreakdown: categoryTotals,
      topMerchants: Object.entries(topMerchants)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([merchant, total]) => ({ merchant, total })),
      subscriptions: subscriptions.map((s) => ({
        merchant: s.merchant,
        monthlyEstimate: Math.round((Number(s.avgAmount) * 30) / s.estimatedCycleDays),
        confidence: s.confidenceScore,
      })),
    };
  }

  private validateRecommendation(data: unknown): asserts data is AiRecommendation {
    const rec = data as AiRecommendation;
    if (!Array.isArray(rec.topLeaks)) throw new Error('Missing topLeaks');
    if (typeof rec.estimatedMonthlySavings !== 'number') throw new Error('Missing estimatedMonthlySavings');
    if (!Array.isArray(rec.actionChecklist)) throw new Error('Missing actionChecklist');
    if (typeof rec.uncertaintyNotes !== 'string') throw new Error('Missing uncertaintyNotes');
  }
}