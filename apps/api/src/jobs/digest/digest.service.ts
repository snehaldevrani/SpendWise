import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AlertsService } from '../../modules/alerts/alerts.service';

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private prisma: PrismaService,
    private alerts: AlertsService,
  ) {}

  // Every Monday at 08:00 IST (02:30 UTC)
  @Cron('30 2 * * 1')
  async sendWeeklyDigests() {
    this.logger.log('Starting weekly digest run');

    const users = await this.prisma.user.findMany({
      where: { preferences: { weeklyEmail: true } },
      select: {
        id: true,
        email: true,
        preferences: { select: { timezone: true } },
      },
    });

    this.logger.log(`Sending weekly digest to ${users.length} users`);

    await Promise.allSettled(
      users.map((user) => this.sendDigestForUser(user.id, user.email)),
    );
  }

  async sendDigestForUser(userId: string, email: string): Promise<void> {
    try {
      // Get latest insight (this week's summary)
      const insight = await this.prisma.insight.findFirst({
        where: { userId },
        orderBy: { weekStart: 'desc' },
      });

      if (!insight) return; // no data yet

      const summary = insight.summaryJson as {
        totalSpent?: number;
        totalCredits?: number;
        categoryBreakdown?: Array<{ category: string; total: number }>;
        topMerchants?: Array<{ merchant: string; total: number }>;
      };

      const totalSpend = summary.totalSpent ?? 0;
      const totalIncome = summary.totalCredits ?? 0;
      const categoryBreakdown = summary.categoryBreakdown ?? [];
      const topMerchants = summary.topMerchants ?? [];

      // Top 3 categories by spend
      const topCats = [...categoryBreakdown]
        .sort((a, b) => b.total - a.total)
        .slice(0, 3);

      const catRows = topCats
        .map((c) => `<li><strong>${c.category}</strong> — ₹${Math.round(c.total).toLocaleString('en-IN')}</li>`)
        .join('');

      const merchantRows = topMerchants
        .slice(0, 3)
        .map((m) => `<li>${m.merchant} — ₹${Math.round(m.total).toLocaleString('en-IN')}</li>`)
        .join('');

      const savings = totalIncome - totalSpend;
      const savingsColor = savings >= 0 ? '#10b981' : '#ef4444';

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h1 style="color: #10b981; margin-bottom: 4px;">SpendWise Weekly Digest</h1>
          <p style="color: #6b7280; margin-bottom: 24px;">
            Week of ${new Date(insight.weekStart).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="padding: 12px; background: #f9fafb; border-radius: 8px; text-align: center;">
                <div style="font-size: 12px; color: #6b7280;">Total Spent</div>
                <div style="font-size: 24px; font-weight: bold; color: #111827;">₹${Math.round(totalSpend).toLocaleString('en-IN')}</div>
              </td>
              <td style="width: 16px;"></td>
              <td style="padding: 12px; background: #f9fafb; border-radius: 8px; text-align: center;">
                <div style="font-size: 12px; color: #6b7280;">Total Income</div>
                <div style="font-size: 24px; font-weight: bold; color: #111827;">₹${Math.round(totalIncome).toLocaleString('en-IN')}</div>
              </td>
              <td style="width: 16px;"></td>
              <td style="padding: 12px; background: #f9fafb; border-radius: 8px; text-align: center;">
                <div style="font-size: 12px; color: #6b7280;">Net Savings</div>
                <div style="font-size: 24px; font-weight: bold; color: ${savingsColor};">₹${Math.abs(Math.round(savings)).toLocaleString('en-IN')}</div>
              </td>
            </tr>
          </table>

          ${topCats.length ? `
          <h3 style="color: #111827;">Top Spending Categories</h3>
          <ul style="color: #374151;">${catRows}</ul>
          ` : ''}

          ${topMerchants.length ? `
          <h3 style="color: #111827;">Top Merchants</h3>
          <ul style="color: #374151;">${merchantRows}</ul>
          ` : ''}

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">
            You're receiving this because you have weekly digests enabled in SpendWise.
            <a href="${process.env.FRONTEND_URL ?? 'https://spendwise.app'}/settings" style="color: #10b981;">Manage preferences</a>
          </p>
        </div>
      `;

      await this.alerts.sendAlert(email, 'SpendWise — Your Weekly Financial Digest', html);
      this.logger.log(`Weekly digest sent to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send digest to ${email}: ${(err as Error).message}`);
    }
  }
}
