import { Injectable } from '@nestjs/common';
import { TransactionCategory } from '@spendwise/shared-types';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    userId: string,
    opts: { page?: number; limit?: number; category?: string; search?: string; startDate?: string; endDate?: string },
  ) {
    const page = opts.page ?? 1;
    const limit = Math.min(opts.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };
    if (opts.category) where['category'] = opts.category;
    if (opts.search) where['merchant'] = { contains: opts.search, mode: 'insensitive' };
    if (opts.startDate || opts.endDate) {
      where['date'] = {
        ...(opts.startDate ? { gte: new Date(opts.startDate) } : {}),
        ...(opts.endDate ? { lte: new Date(opts.endDate) } : {}),
      };
    }

    const [total, items] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        select: { id: true, date: true, merchant: true, amount: true, currency: true, category: true, type: true },
      }),
    ]);

    return { total, page, limit, items };
  }

  async updateCategory(userId: string, transactionId: string, category: TransactionCategory) {
    return this.prisma.transaction.update({
      where: { id: transactionId, userId },
      data: { category },
    });
  }

  async getMonthlySummary(userId: string, month: number, year: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const transactions = await this.prisma.transaction.findMany({
      where: { userId, date: { gte: start, lte: end } },
      select: { category: true, amount: true, type: true },
    });

    const breakdown: Record<string, { total: number; count: number }> = {};
    let totalSpend = 0;
    let totalIncome = 0;

    for (const t of transactions) {
      const amt = Number(t.amount);
      if (t.type === 'debit') {
        const cat = t.category;
        if (!breakdown[cat]) breakdown[cat] = { total: 0, count: 0 };
        breakdown[cat].total += amt;
        breakdown[cat].count += 1;
        totalSpend += amt;
      } else {
        totalIncome += amt;
      }
    }

    return {
      month,
      year,
      total: Math.round(totalSpend * 100) / 100,
      totalIncome: Math.round(totalIncome * 100) / 100,
      savings: Math.round((totalIncome - totalSpend) * 100) / 100,
      breakdown: Object.entries(breakdown)
        .map(([category, data]) => ({ category, total: Math.round(data.total * 100) / 100, count: data.count }))
        .sort((a, b) => b.total - a.total),
    };
  }

  async getOverview(userId: string) {
    // Find the latest month that has transactions
    const latest = await this.prisma.transaction.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { date: true },
    });

    if (!latest) return null;

    const latestMonth = latest.date.getMonth() + 1;
    const latestYear = latest.date.getFullYear();

    // Get current month summary
    const current = await this.getMonthlySummary(userId, latestMonth, latestYear);

    // Get previous month summary
    const prevMonth = latestMonth === 1 ? 12 : latestMonth - 1;
    const prevYear = latestMonth === 1 ? latestYear - 1 : latestYear;
    const previous = await this.getMonthlySummary(userId, prevMonth, prevYear);

    return { current, previous, latestMonth, latestYear };
  }

  async getDailySpend(userId: string, days = 60) {
    const latest = await this.prisma.transaction.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    if (!latest) return [];

    const refDate = new Date(latest.date);
    const start = new Date(refDate);
    start.setDate(start.getDate() - days);

    const txns = await this.prisma.transaction.findMany({
      where: { userId, type: 'debit', date: { gte: start, lte: refDate } },
      select: { date: true, amount: true },
    });

    const map = new Map<string, number>();
    for (const t of txns) {
      const key = new Date(t.date).toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + Number(t.amount));
    }

    const result: Array<{ date: string; amount: number }> = [];
    for (let i = 0; i <= days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      result.push({ date: key, amount: map.get(key) ?? 0 });
    }
    return result;
  }

  async clearAllData(userId: string) {
    await this.prisma.subscription.deleteMany({ where: { userId } });
    await this.prisma.transaction.deleteMany({ where: { userId } });
    return { deleted: true };
  }

  /**
   * Returns monthly spend per category for the last N months.
   * Shape: [{ month: '2026-01', food: 3200, shopping: 1500, ... }, ...]
   */
  async getCategoryTrends(userId: string, months = 6) {
    const now = new Date();
    const results: Array<Record<string, string | number>> = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = date.getMonth() + 1;
      const y = date.getFullYear();
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59);

      const txns = await this.prisma.transaction.findMany({
        where: { userId, type: 'debit', date: { gte: start, lte: end } },
        select: { category: true, amount: true },
      });

      const row: Record<string, string | number> = {
        month: `${y}-${String(m).padStart(2, '0')}`,
      };
      for (const t of txns) {
        const cat = t.category as string;
        row[cat] = Math.round(((row[cat] as number ?? 0) + Number(t.amount)) * 100) / 100;
      }
      results.push(row);
    }

    return results;
  }
}
