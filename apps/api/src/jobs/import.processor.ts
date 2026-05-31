import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RagService } from '../modules/rag/rag.service';
import { SubscriptionsService } from '../modules/subscriptions/subscriptions.service';
import { InsightsService } from '../modules/insights/insights.service';
import { AlertsService } from '../modules/alerts/alerts.service';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  IMPORT_QUEUE,
  JOB_EMBED_TRANSACTIONS,
  JOB_DETECT_SUBSCRIPTIONS,
  JOB_COMPUTE_INSIGHTS,
} from './queue.constants';

@Processor(IMPORT_QUEUE)
export class ImportProcessor extends WorkerHost {
  private readonly logger = new Logger(ImportProcessor.name);

  constructor(
    private rag: RagService,
    private subscriptions: SubscriptionsService,
    private insights: InsightsService,
    private alerts: AlertsService,
    private prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { userId } = job.data as { userId: string };

    if (job.name === JOB_EMBED_TRANSACTIONS) {
      this.logger.log(`Embedding transactions for user ${userId}`);
      try {
        await this.rag.embedAllForUser(userId);
        this.logger.log(`Embeddings complete for user ${userId}`);
      } catch (err) {
        this.logger.error(`Embedding failed for user ${userId}`, err);
        throw err;
      }
    }

    if (job.name === JOB_DETECT_SUBSCRIPTIONS) {
      this.logger.log(`Detecting subscriptions for user ${userId}`);
      try {
        await this.subscriptions.runDetection(userId);
        this.logger.log(`Subscription detection complete for user ${userId}`);
        // Fire-and-forget email alert for new leaks (non-blocking)
        this.sendLeakAlertIfNeeded(userId).catch((err) =>
          this.logger.warn(`Failed to send leak alert for user ${userId}`, err),
        );
      } catch (err) {
        this.logger.error(`Subscription detection failed for user ${userId}`, err);
        throw err;
      }
    }

    if (job.name === JOB_COMPUTE_INSIGHTS) {
      this.logger.log(`Computing insights for user ${userId}`);
      try {
        await this.insights.compute(userId);
        this.logger.log(`Insights computed for user ${userId}`);
      } catch (err) {
        this.logger.error(`Insights computation failed for user ${userId}`, err);
        throw err;
      }
    }
  }

  private async sendLeakAlertIfNeeded(userId: string): Promise<void> {
    const [user, prefs, leaks] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
      this.prisma.userPreferences.findUnique({ where: { userId }, select: { newSubAlert: true } }),
      this.subscriptions.getLeaks(userId),
    ]);

    if (!user || !prefs?.newSubAlert || leaks.length === 0) return;

    const leakPayload = leaks.map((l) => ({
      merchant: l.merchant,
      annualCost: Math.round(Number(l.avgAmount) * (365 / l.estimatedCycleDays)),
    }));

    await this.alerts.sendSubscriptionLeakAlert(user.email, leakPayload);
    this.logger.log(`Sent leak alert to ${user.email} for ${leaks.length} leak(s)`);
  }
}
