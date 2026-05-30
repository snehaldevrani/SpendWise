import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RagService } from '../modules/rag/rag.service';
import { SubscriptionsService } from '../modules/subscriptions/subscriptions.service';
import { InsightsService } from '../modules/insights/insights.service';
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
}
