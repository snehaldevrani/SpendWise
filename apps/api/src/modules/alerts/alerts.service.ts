import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';

interface ResendResponse {
  id?: string;
  statusCode?: number;
  message?: string;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private readonly resendApiKey: string;
  private readonly fromEmail: string;

  constructor(private config: ConfigService, private prisma: PrismaService) {
    this.resendApiKey = this.config.get('RESEND_API_KEY', '');
    this.fromEmail = this.config.get('RESEND_FROM_EMAIL', 'alerts@spendwise.app');
  }

  async sendAlert(to: string, subject: string, html: string): Promise<void> {
    if (!this.resendApiKey) {
      this.logger.warn('RESEND_API_KEY not configured — skipping email send');
      return;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.resendApiKey}`,
      },
      body: JSON.stringify({
        from: this.fromEmail,
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as ResendResponse;
      this.logger.error(`Resend API error: ${response.status} — ${body.message ?? 'unknown'}`);
      throw new ServiceUnavailableException('Failed to send alert email');
    }

    const result = (await response.json()) as ResendResponse;
    this.logger.log(`Alert sent via Resend: ${result.id}`);
  }

  async sendTestAlert(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) throw new NotFoundException('User not found');
    await this.sendAlert(
      user.email,
      'SpendWise — Test Alert',
      `<p>This is a test alert from SpendWise.</p>
       <p>Your alert delivery is working correctly.</p>`,
    );
    return { message: 'Test alert sent successfully' };
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  }

  async sendSubscriptionLeakAlert(email: string, leaks: Array<{ merchant: string; annualCost: number }>): Promise<void> {
    const rows = leaks
      .map((l) => `<li><strong>${this.escapeHtml(l.merchant)}</strong> — ₹${l.annualCost.toLocaleString()} / year</li>`)
      .join('');

    await this.sendAlert(
      email,
      'SpendWise — Potential Subscription Leaks Detected',
      `<h2>Subscription Leaks Detected</h2>
       <p>The following recurring charges may be costing you more than expected:</p>
       <ul>${rows}</ul>
       <p>Log in to SpendWise to review and dismiss these alerts.</p>`,
    );
  }
}
