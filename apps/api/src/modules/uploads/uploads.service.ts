import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CsvImportResult } from '@spendwise/shared-types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CsvParserService } from './csv-parser.service';
import {
  IMPORT_QUEUE,
  JOB_EMBED_TRANSACTIONS,
  JOB_DETECT_SUBSCRIPTIONS,
  JOB_COMPUTE_INSIGHTS,
} from '../../jobs/queue.constants';

@Injectable()
export class UploadsService {
  constructor(
    private prisma: PrismaService,
    private csvParser: CsvParserService,
    @InjectQueue(IMPORT_QUEUE) private importQueue: Queue,
  ) {}

  async importCsv(userId: string, file: Express.Multer.File, password?: string): Promise<CsvImportResult> {
    const ext = file.originalname.toLowerCase();
    if (!ext.endsWith('.csv') && !ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      throw new BadRequestException('Supported formats: CSV, XLS, XLSX');
    }

    const { rows, errors } = this.csvParser.parse(file.buffer, file.originalname, password);

    // Wipe previous data so each upload starts fresh
    await this.prisma.subscription.deleteMany({ where: { userId } });
    await this.prisma.transaction.deleteMany({ where: { userId } });

    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      try {
        await this.prisma.transaction.create({
          data: {
            userId,
            date: row.date,
            merchant: row.merchant,
            amount: row.amount,
            currency: row.currency,
            type: row.type,
            category: row.category,
            rawText: row.rawText,
            dedupKey: row.dedupKey,
          },
        });
        inserted++;
      } catch (err: unknown) {
        if (this.isUniqueConstraintError(err)) {
          skipped++;
        } else {
          errors.push({ row: -1, message: `DB error for ${row.merchant}: ${String(err)}` });
        }
      }
    }

    if (inserted > 0) {
      await this.importQueue.add(
        JOB_EMBED_TRANSACTIONS,
        { userId },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      );
      await this.importQueue.add(
        JOB_DETECT_SUBSCRIPTIONS,
        { userId },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      );
      await this.importQueue.add(
        JOB_COMPUTE_INSIGHTS,
        { userId },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      );
    }

    return { inserted, skipped, failed: errors.length, errors };
  }

  private isUniqueConstraintError(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    );
  }
}
