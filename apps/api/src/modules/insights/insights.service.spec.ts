import { InsightsService } from './insights.service';
import { PrismaService } from '../../common/prisma/prisma.service';

function makeTxn(overrides: {
  date: Date;
  amount: number;
  category?: string;
  merchant?: string;
  type?: 'debit' | 'credit';
}) {
  return {
    date: overrides.date,
    amount: overrides.amount,
    category: overrides.category ?? 'food',
    merchant: overrides.merchant ?? 'TestMerchant',
    type: overrides.type ?? 'debit',
  };
}

/** Return the ISO Monday-start week for a given date (UTC) */
function isoWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

describe('InsightsService', () => {
  let service: InsightsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    prisma = {
      transaction: {
        findMany: jest.fn(),
      },
      insight: {
        upsert: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    service = new InsightsService(prisma);
  });

  describe('getAll', () => {
    it('returns all insights for a user ordered by weekStart desc', async () => {
      const mockInsights = [
        { id: '1', userId: 'u1', weekStart: new Date('2025-01-13') },
        { id: '2', userId: 'u1', weekStart: new Date('2025-01-06') },
      ];
      (prisma.insight.findMany as jest.Mock).mockResolvedValue(mockInsights);

      const result = await service.getAll('u1');
      expect(result).toEqual(mockInsights);
      expect(prisma.insight.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' } }),
      );
    });
  });

  describe('getCurrent', () => {
    it('returns the most recent insight', async () => {
      const mockInsight = { id: '1', userId: 'u1', weekStart: new Date('2025-01-13') };
      (prisma.insight.findFirst as jest.Mock).mockResolvedValue(mockInsight);

      const result = await service.getCurrent('u1');
      expect(result).toEqual(mockInsight);
    });

    it('returns null when no insights exist', async () => {
      (prisma.insight.findFirst as jest.Mock).mockResolvedValue(null);
      const result = await service.getCurrent('u1');
      expect(result).toBeNull();
    });
  });

  describe('compute — weekly grouping', () => {
    it('returns early with no upsert when user has no transactions', async () => {
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);

      await service.compute('u1');

      expect(prisma.insight.upsert).not.toHaveBeenCalled();
    });

    it('groups transactions into the same week when they share an ISO week', async () => {
      // Monday Jan 6 and Wednesday Jan 8 2025 are in the same ISO week
      const txns = [
        makeTxn({ date: new Date('2025-01-06'), amount: 100 }),
        makeTxn({ date: new Date('2025-01-08'), amount: 200 }),
      ];
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue(txns);

      await service.compute('u1');

      // Should produce exactly 1 upsert (both txns in the same week)
      expect(prisma.insight.upsert).toHaveBeenCalledTimes(1);
    });

    it('groups transactions into separate weeks when they span different ISO weeks', async () => {
      // Jan 6 (Mon week 2) and Jan 13 (Mon week 3)
      const txns = [
        makeTxn({ date: new Date('2025-01-06'), amount: 100 }),
        makeTxn({ date: new Date('2025-01-13'), amount: 200 }),
      ];
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue(txns);

      await service.compute('u1');

      expect(prisma.insight.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('compute — category totals', () => {
    it('aggregates debit amounts per category correctly', async () => {
      const txns = [
        makeTxn({ date: new Date('2025-01-06'), amount: 300, category: 'food', merchant: 'Swiggy' }),
        makeTxn({ date: new Date('2025-01-07'), amount: 200, category: 'food', merchant: 'Zomato' }),
        makeTxn({ date: new Date('2025-01-08'), amount: 500, category: 'shopping', merchant: 'Amazon' }),
      ];
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue(txns);

      await service.compute('u1');

      const upsertCall = (prisma.insight.upsert as jest.Mock).mock.calls[0][0];
      const summary = upsertCall.create.summaryJson as {
        totalSpent: number;
        categoryBreakdown: Array<{ category: string; total: number }>;
      };

      expect(summary.totalSpent).toBe(1000);
      const food = summary.categoryBreakdown.find((c) => c.category === 'food');
      expect(food?.total).toBe(500);
      const shopping = summary.categoryBreakdown.find((c) => c.category === 'shopping');
      expect(shopping?.total).toBe(500);
    });

    it('excludes credit transactions from totalSpent', async () => {
      const txns = [
        makeTxn({ date: new Date('2025-01-06'), amount: 1000, type: 'credit', merchant: 'Salary' }),
        makeTxn({ date: new Date('2025-01-07'), amount: 200, type: 'debit', merchant: 'Swiggy' }),
      ];
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue(txns);

      await service.compute('u1');

      const upsertCall = (prisma.insight.upsert as jest.Mock).mock.calls[0][0];
      const summary = upsertCall.create.summaryJson as { totalSpent: number; totalCredits: number };

      expect(summary.totalSpent).toBe(200);
      expect(summary.totalCredits).toBe(1000);
    });

    it('sorts categories by total descending', async () => {
      const txns = [
        makeTxn({ date: new Date('2025-01-06'), amount: 100, category: 'shopping' }),
        makeTxn({ date: new Date('2025-01-07'), amount: 800, category: 'food' }),
        makeTxn({ date: new Date('2025-01-08'), amount: 300, category: 'travel' }),
      ];
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue(txns);

      await service.compute('u1');

      const upsertCall = (prisma.insight.upsert as jest.Mock).mock.calls[0][0];
      const summary = upsertCall.create.summaryJson as {
        categoryBreakdown: Array<{ category: string; total: number }>;
      };

      expect(summary.categoryBreakdown[0].category).toBe('food');
      expect(summary.categoryBreakdown[1].category).toBe('travel');
      expect(summary.categoryBreakdown[2].category).toBe('shopping');
    });
  });

  describe('compute — top merchants', () => {
    it('ranks top merchants by debit spend, capped at 5', async () => {
      const merchants = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      const txns = merchants.map((m, i) =>
        makeTxn({ date: new Date('2025-01-06'), amount: (merchants.length - i) * 100, merchant: m }),
      );
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue(txns);

      await service.compute('u1');

      const upsertCall = (prisma.insight.upsert as jest.Mock).mock.calls[0][0];
      const summary = upsertCall.create.summaryJson as {
        topMerchants: Array<{ merchant: string; total: number }>;
      };

      expect(summary.topMerchants.length).toBeLessThanOrEqual(5);
      expect(summary.topMerchants[0].merchant).toBe('A');
    });

    it('accumulates spend for the same merchant across multiple transactions', async () => {
      const txns = [
        makeTxn({ date: new Date('2025-01-06'), amount: 300, merchant: 'Amazon' }),
        makeTxn({ date: new Date('2025-01-07'), amount: 200, merchant: 'Amazon' }),
        makeTxn({ date: new Date('2025-01-08'), amount: 100, merchant: 'Swiggy' }),
      ];
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue(txns);

      await service.compute('u1');

      const upsertCall = (prisma.insight.upsert as jest.Mock).mock.calls[0][0];
      const summary = upsertCall.create.summaryJson as {
        topMerchants: Array<{ merchant: string; total: number }>;
      };

      const amazon = summary.topMerchants.find((m) => m.merchant === 'Amazon');
      expect(amazon?.total).toBe(500);
    });
  });

  describe('compute — ISO week boundaries', () => {
    it('sets weekStart to Monday of the given week', async () => {
      // Jan 8 2025 is a Wednesday — its ISO week starts on Monday Jan 6
      const txns = [makeTxn({ date: new Date('2025-01-08'), amount: 100 })];
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue(txns);

      await service.compute('u1');

      const upsertCall = (prisma.insight.upsert as jest.Mock).mock.calls[0][0];
      const weekStart: Date = upsertCall.create.weekStart;

      // Should be Monday Jan 6
      expect(weekStart.getUTCDay()).toBe(1); // Monday = 1
      expect(weekStart.getUTCDate()).toBe(6);
    });

    it('sets weekEnd to Sunday (6 days after weekStart)', async () => {
      const txns = [makeTxn({ date: new Date('2025-01-06'), amount: 100 })];
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue(txns);

      await service.compute('u1');

      const upsertCall = (prisma.insight.upsert as jest.Mock).mock.calls[0][0];
      const summary = upsertCall.create.summaryJson as { weekEnd: string };

      expect(summary.weekEnd).toBe('2025-01-12');
    });

    it('handles a Sunday date — its week started the previous Monday', async () => {
      // Jan 5 2025 is a Sunday — ISO week started on Mon Dec 30 2024
      const txns = [makeTxn({ date: new Date('2025-01-05'), amount: 50 })];
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue(txns);

      await service.compute('u1');

      const upsertCall = (prisma.insight.upsert as jest.Mock).mock.calls[0][0];
      const weekStart: Date = upsertCall.create.weekStart;
      expect(weekStart.getUTCDay()).toBe(1); // Always Monday
    });
  });
});
