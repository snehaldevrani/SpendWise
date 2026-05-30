import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

  constructor(private config: ConfigService) {
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

  async sendTestAlert(userId: string, email?: string): Promise<{ message: string }> {
    const to = email ?? 'test@example.com';
    await this.sendAlert(
      to,
      'SpendWise — Test Alert',
      `<p>This is a test alert from SpendWise for user <strong>${userId}</strong>.</p>
       <p>Your alert delivery is working correctly.</p>`,
    );
    return { message: 'Test alert sent successfully' };
  }

  async sendSubscriptionLeakAlert(email: string, leaks: Array<{ merchant: string; annualCost: number }>): Promise<void> {
    const rows = leaks
      .map((l) => `<li><strong>${l.merchant}</strong> — ₹${l.annualCost.toLocaleString()} / year</li>`)
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
