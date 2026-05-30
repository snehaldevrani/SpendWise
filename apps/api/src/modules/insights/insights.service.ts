import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

interface CategoryTotal {
  category: string;
  total: number;
  count: number;
}

interface TopMerchant {
  merchant: string;
  total: number;
}

interface WeekSummary {
  weekStart: string;
  weekEnd: string;
  totalSpent: number;
  totalCredits: number;
  transactionCount: number;
  categoryBreakdown: CategoryTotal[];
  topMerchants: TopMerchant[];
}

@Injectable()
export class InsightsService {
  constructor(private prisma: PrismaService) {}

  async getCurrent(userId: string) {
    return this.prisma.insight.findFirst({
      where: { userId },
      orderBy: { weekStart: 'desc' },
    });
  }

  async getAll(userId: string) {
    return this.prisma.insight.findMany({
      where: { userId },
      orderBy: { weekStart: 'desc' },
      take: 12,
    });
  }

  async compute(userId: string): Promise<void> {
    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
      select: { date: true, amount: true, category: true, merchant: true, type: true },
      orderBy: { date: 'asc' },
    });

    if (transactions.length === 0) return;

    // Group transactions into ISO weeks (Monday as week start)
    const weeks = new Map<string, typeof transactions>();
    for (const txn of transactions) {
      const weekStart = this.getWeekStart(txn.date);
      const key = weekStart.toISOString();
      if (!weeks.has(key)) weeks.set(key, []);
      weeks.get(key)!.push(txn);
    }

    for (const [weekKey, txns] of weeks.entries()) {
      const weekStart = new Date(weekKey);

      let totalSpent = 0;
      let totalCredits = 0;
      const categoryMap = new Map<string, { total: number; count: number }>();
      const merchantMap = new Map<string, number>();

      for (const txn of txns) {
        const amount = Number(txn.amount);
        if (txn.type === 'debit') {
          totalSpent += amount;
          // Category aggregation
          const existing = categoryMap.get(txn.category) ?? { total: 0, count: 0 };
          categoryMap.set(txn.category, { total: existing.total + amount, count: existing.count + 1 });
          // Merchant aggregation
          merchantMap.set(txn.merchant, (merchantMap.get(txn.merchant) ?? 0) + amount);
        } else {
          totalCredits += amount;
        }
      }

      const categoryBreakdown: CategoryTotal[] = Array.from(categoryMap.entries())
        .map(([category, { total, count }]) => ({ category, total: Math.round(total * 100) / 100, count }))
        .sort((a, b) => b.total - a.total);

      const topMerchants: TopMerchant[] = Array.from(merchantMap.entries())
        .map(([merchant, total]) => ({ merchant, total: Math.round(total * 100) / 100 }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      const summary: WeekSummary = {
        weekStart: weekStart.toISOString().slice(0, 10),
        weekEnd: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        totalSpent: Math.round(totalSpent * 100) / 100,
        totalCredits: Math.round(totalCredits * 100) / 100,
        transactionCount: txns.length,
        categoryBreakdown,
        topMerchants,
      };

      await this.prisma.insight.upsert({
        where: { userId_weekStart: { userId, weekStart } },
        create: { userId, weekStart, summaryJson: summary as object },
        update: { summaryJson: summary as object },
      });
    }
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday
    const diff = day === 0 ? -6 : 1 - day; // Monday as start
    d.setUTCDate(d.getUTCDate() + diff);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
}
