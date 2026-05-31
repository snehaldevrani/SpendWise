import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CsvImportResult } from '@spendwise/shared-types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
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
    private cache: CacheService,
    @InjectQueue(IMPORT_QUEUE) private importQueue: Queue,
  ) {}

  async importCsv(userId: string, file: Express.Multer.File, password?: string): Promise<CsvImportResult> {
    const ext = file.originalname.toLowerCase();
    if (!ext.endsWith('.csv') && !ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      throw new BadRequestException('Supported formats: CSV, XLS, XLSX');
    }

    // Validate magic bytes to prevent disguised file attacks
    this.validateMagicBytes(file.buffer, ext);

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
          errors.push({ row: -1, message: `Failed to save transaction (row ${inserted + skipped + errors.length + 1})` });
        }
      }
    }

    if (inserted > 0) {
      // Bust AI recommendations cache — new data means stale insights
      await this.cache.del(`ai:recs:${userId}`);

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

  /**
   * Validate file magic bytes to prevent extension-spoofing attacks.
   * CSV has no magic bytes (text file) — allow it through.
   * XLSX/XLS are ZIP or OLE2 Compound Documents.
   */
  private validateMagicBytes(buffer: Buffer, filename: string): void {
    if (filename.endsWith('.csv')) return; // plain text, no signature

    if (filename.endsWith('.xlsx')) {
      // XLSX is a ZIP file — magic bytes: 50 4B 03 04
      const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
      if (!isZip) throw new BadRequestException('File content does not match XLSX format');
    }

    if (filename.endsWith('.xls')) {
      // XLS is OLE2 Compound Document — magic bytes: D0 CF 11 E0
      const isOle = buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
      if (!isOle) throw new BadRequestException('File content does not match XLS format');
    }
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
