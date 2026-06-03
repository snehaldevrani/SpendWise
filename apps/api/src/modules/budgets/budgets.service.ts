import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TransactionCategory } from '@spendwise/shared-types';

@Injectable()
export class BudgetsService {
  constructor(private prisma: PrismaService) {}

  async getBudgets(userId: string, month: number, year: number) {
    // 1. Fetch explicit budgets for the given month/year
    const explicit = await this.prisma.budget.findMany({
      where: { userId, month, year },
      select: { id: true, category: true, limitAmount: true, month: true, year: true, recurring: true },
    });

    // 2. Fetch recurring budgets (sentinel month=0, year=0)
    const recurring = await this.prisma.budget.findMany({
      where: { userId, month: 0, year: 0, recurring: true },
      select: { id: true, category: true, limitAmount: true, month: true, year: true, recurring: true },
    });

    // 3. Merge: explicit rows win; fill remaining categories from recurring
    const explicitCategories = new Set(explicit.map((b) => b.category as string));
    const merged = [
      ...explicit,
      ...recurring.filter((r) => !explicitCategories.has(r.category as string)),
    ];

    if (merged.length === 0) return [];

    // 4. Fetch actual spend per category for the queried month/year
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const txns = await this.prisma.transaction.findMany({
      where: { userId, type: 'debit', date: { gte: start, lte: end } },
      select: { category: true, amount: true },
    });

    const spent: Record<string, number> = {};
    for (const t of txns) {
      const cat = t.category as string;
      spent[cat] = (spent[cat] ?? 0) + Number(t.amount);
    }

    // 5. Compute remaining, % used, forecast
    const today = new Date();
    const daysInMonth = new Date(year, month, 0).getDate();
    const dayOfMonth = (year === today.getFullYear() && month === (today.getMonth() + 1))
      ? today.getDate()
      : daysInMonth;
    const forecastMultiplier = daysInMonth / Math.max(dayOfMonth, 1);

    return merged.map((b) => {
      const limit = Number(b.limitAmount);
      const spentAmt = Math.round((spent[b.category as string] ?? 0) * 100) / 100;
      const remaining = Math.round((limit - spentAmt) * 100) / 100;
      const percentUsed = limit > 0 ? Math.round((spentAmt / limit) * 100) : 0;
      const forecast = Math.round(spentAmt * forecastMultiplier * 100) / 100;
      const status: 'ok' | 'warning' | 'over' =
        percentUsed >= 100 ? 'over' : percentUsed >= 80 ? 'warning' : 'ok';

      return {
        id: b.id,
        category: b.category,
        limitAmount: limit,
        spent: spentAmt,
        remaining,
        percentUsed,
        forecast,
        status,
        month: b.recurring ? month : b.month,
        year: b.recurring ? year : b.year,
        recurring: b.recurring,
      };
    });
  }

  async upsertBudget(
    userId: string,
    category: TransactionCategory,
    limitAmount: number,
    month: number,
    year: number,
    recurring: boolean,
  ) {
    // Recurring budgets use sentinel month=0, year=0 so they match all months
    const m = recurring ? 0 : month;
    const y = recurring ? 0 : year;

    return this.prisma.budget.upsert({
      where: { userId_category_month_year: { userId, category, month: m, year: y } },
      create: { userId, category, limitAmount, month: m, year: y, recurring },
      update: { limitAmount, recurring },
    });
  }

  async deleteBudget(userId: string, id: string) {
    return this.prisma.budget.delete({ where: { id, userId } });
  }

  async getBudgetSummary(userId: string, month: number, year: number) {
    const items = await this.getBudgets(userId, month, year);
    const totalLimit = items.reduce((sum, b) => sum + b.limitAmount, 0);
    const totalSpent = items.reduce((sum, b) => sum + b.spent, 0);
    const overBudget = items.filter((b) => b.status === 'over').length;
    const healthScore = totalLimit > 0
      ? Math.max(0, Math.round(100 - (totalSpent / totalLimit) * 100))
      : 100;

    return { items, totalLimit, totalSpent, overBudget, healthScore };
  }
}
