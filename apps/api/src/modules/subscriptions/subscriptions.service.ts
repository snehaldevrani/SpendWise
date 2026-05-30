import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SubscriptionDetectorService } from './subscription-detector.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    private detector: SubscriptionDetectorService,
  ) {}

  async runDetection(userId: string): Promise<void> {
    const transactions = await this.prisma.transaction.findMany({
      where: { userId, type: 'debit' },
      select: { merchant: true, amount: true, date: true },
    });

    const grouped: Record<string, Array<{ date: Date; amount: number }>> = {};
    for (const t of transactions) {
      if (!grouped[t.merchant]) grouped[t.merchant] = [];
      grouped[t.merchant].push({ date: t.date, amount: Number(t.amount) });
    }

    const detected = this.detector.detect(grouped);

    for (const sub of detected) {
      await this.prisma.subscription.upsert({
        where: { userId_merchant: { userId, merchant: sub.merchant } },
        create: { userId, ...sub },
        update: {
          estimatedCycleDays: sub.estimatedCycleDays,
          avgAmount: sub.avgAmount,
          confidenceScore: sub.confidenceScore,
          lastChargeDate: sub.lastChargeDate,
          nextExpectedDate: sub.nextExpectedDate,
        },
      });
    }
  }

  async findAll(userId: string) {
    return this.prisma.subscription.findMany({
      where: { userId, dismissed: false },
      orderBy: { confidenceScore: 'desc' },
    });
  }

  async dismiss(userId: string, id: string) {
    return this.prisma.subscription.update({
      where: { id, userId },
      data: { dismissed: true },
    });
  }

  async confirm(userId: string, id: string) {
    return this.prisma.subscription.update({
      where: { id, userId },
      data: { confirmed: true },
    });
  }

  async getLeaks(userId: string) {
    const subs = await this.prisma.subscription.findMany({
      where: { userId, dismissed: false, confidenceScore: { gte: 0.5 } },
    });

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    return subs
      .map((sub) => {
        const annualCost = (Number(sub.avgAmount) * 365) / sub.estimatedCycleDays;
        const isLikelyUnused = sub.lastChargeDate < sixtyDaysAgo;
        return {
          ...sub,
          annualCost: Math.round(annualCost),
          isLikelyUnused,
        };
      })
      .sort((a, b) => b.annualCost - a.annualCost);
  }
}
