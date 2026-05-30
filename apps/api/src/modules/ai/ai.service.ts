import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AiRecommendation } from '@spendwise/shared-types';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AiService {
  private client: Anthropic;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.client = new Anthropic({ apiKey: this.config.get('ANTHROPIC_API_KEY') });
  }

  async getRecommendations(userId: string): Promise<AiRecommendation> {
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

    try {
      const parsed = JSON.parse(raw.text) as AiRecommendation;
      this.validateRecommendation(parsed);
      return parsed;
    } catch {
      throw new ServiceUnavailableException('AI returned malformed response');
    }
  }

  async chat(userId: string, question: string, contextChunks: string[]): Promise<string> {
    const context = contextChunks.length > 0
      ? `Relevant transaction history:\n${contextChunks.join('\n')}\n\n`
      : '';

    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: `You are a personal finance assistant. Answer questions about the user's spending using only the provided data.
Be concise. If the data doesn't contain an answer, say so honestly.`,
      messages: [
        {
          role: 'user',
          content: `${context}Question: ${question}`,
        },
      ],
    });

    const raw = message.content[0];
    if (raw.type !== 'text') throw new ServiceUnavailableException('Unexpected AI response');
    return raw.text;
  }

  private async buildUserStats(userId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const [recentTransactions, subscriptions] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId, date: { gte: thirtyDaysAgo }, type: 'debit' },
        select: { merchant: true, amount: true, category: true, date: true },
        orderBy: { amount: 'desc' },
        take: 50,
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
      period: 'last 30 days',
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
