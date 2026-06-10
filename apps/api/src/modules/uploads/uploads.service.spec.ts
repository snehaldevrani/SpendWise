import { BadRequestException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { CacheService } from '../../common/cache/cache.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CsvParserService } from './csv-parser.service';
import { UploadsService } from './uploads.service';

function makeFile(
  content: string,
  name = 'bank.csv',
  mimetype = 'text/csv',
): Express.Multer.File {
  return {
    originalname: name,
    buffer: Buffer.from(content, 'utf-8'),
    mimetype,
    size: Buffer.byteLength(content),
    fieldname: 'file',
    encoding: '7bit',
    destination: '',
    filename: '',
    path: '',
    stream: null as never,
  };
}

const VALID_CSV = `date,merchant,amount,type
01/01/2025,Swiggy,350,debit
02/01/2025,Netflix,649,debit
03/01/2025,Salary,50000,credit`;

describe('UploadsService', () => {
  let service: UploadsService;
  let prisma: jest.Mocked<PrismaService>;
  let cache: jest.Mocked<CacheService>;
  let queue: jest.Mocked<Queue>;

  beforeEach(() => {
    prisma = {
      subscription: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      transaction: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
    } as unknown as jest.Mocked<PrismaService>;

    cache = {
      del: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CacheService>;

    queue = {
      add: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<Queue>;

    const customCategories = { applyRules: jest.fn().mockResolvedValue(undefined) } as never;
    service = new UploadsService(prisma, new CsvParserService(), cache, customCategories, queue);
  });

  describe('importCsv file type validation', () => {
    it('throws BadRequestException for truly unsupported file types (e.g. .json)', async () => {
      const jsonFile = makeFile('{"key":"val"}', 'bank.json', 'application/json');

      await expect(service.importCsv('u1', jsonFile)).rejects.toThrow(BadRequestException);
      await expect(service.importCsv('u1', jsonFile)).rejects.toThrow('Supported formats');
    });

    it('throws BadRequestException when PDF magic bytes are wrong (spoofed extension)', async () => {
      const fakePdf = makeFile('not a pdf', 'bank.pdf', 'application/pdf');
      fakePdf.buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);

      await expect(service.importCsv('u1', fakePdf)).rejects.toThrow(BadRequestException);
      await expect(service.importCsv('u1', fakePdf)).rejects.toThrow('does not match PDF format');
    });

    it('accepts .csv files', async () => {
      const file = makeFile(VALID_CSV, 'bank.csv');

      const result = await service.importCsv('u1', file);
      expect(result.inserted).toBeGreaterThan(0);
    });
  });

  describe('importCsv magic byte validation', () => {
    it('throws BadRequestException if .xlsx file does not have ZIP magic bytes', async () => {
      const fakeXlsx = makeFile('PK fake content', 'bank.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      fakeXlsx.buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);

      await expect(service.importCsv('u1', fakeXlsx)).rejects.toThrow(BadRequestException);
      await expect(service.importCsv('u1', fakeXlsx)).rejects.toThrow('XLSX format');
    });
  });

  describe('importCsv PDF handling', () => {
    it('passes the supplied password to the PDF parser', async () => {
      const parser = {
        parsePdf: jest.fn().mockResolvedValue({
          rows: [
            {
              date: new Date('2026-02-01'),
              merchant: 'Zomato',
              amount: 331.7,
              currency: 'INR',
              type: 'debit',
              rawText: '01/02/26 Zomato 331.70',
              dedupKey: 'pdf-row-1',
              category: 'food',
            },
          ],
          errors: [],
        }),
        parse: jest.fn(),
      } as unknown as CsvParserService;
      service = new UploadsService(
        prisma,
        parser,
        cache,
        { applyRules: jest.fn().mockResolvedValue(undefined) } as never,
        queue,
      );

      const pdfFile = makeFile('%PDF-1.7 fake', 'statement.pdf', 'application/pdf');
      pdfFile.buffer = Buffer.from('%PDF-1.7 fake');

      await service.importCsv('u1', pdfFile, '327919428');

      expect(parser.parsePdf).toHaveBeenCalledWith(pdfFile.buffer, '327919428');
      expect(prisma.transaction.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('importCsv full flow', () => {
    it('clears existing subscriptions and transactions before inserting', async () => {
      const file = makeFile(VALID_CSV, 'bank.csv');

      await service.importCsv('u1', file);

      expect(prisma.subscription.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(prisma.transaction.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    });

    it('inserts all valid parsed rows', async () => {
      const file = makeFile(VALID_CSV, 'bank.csv');

      const result = await service.importCsv('u1', file);

      expect(result.inserted).toBe(3);
      expect(result.skipped).toBe(0);
      expect(result.failed).toBe(0);
      expect(prisma.transaction.create).toHaveBeenCalledTimes(3);
    });

    it('skips duplicate rows (unique constraint violation)', async () => {
      (prisma.transaction.create as jest.Mock)
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce({ code: 'P2002' })
        .mockResolvedValueOnce({});

      const file = makeFile(VALID_CSV, 'bank.csv');

      const result = await service.importCsv('u1', file);

      expect(result.inserted).toBe(2);
      expect(result.skipped).toBe(1);
    });

    it('busts AI recommendations cache after inserting data', async () => {
      const file = makeFile(VALID_CSV, 'bank.csv');

      await service.importCsv('u1', file);

      expect(cache.del).toHaveBeenCalledWith('ai:recs:u1');
    });

    it('enqueues 3 background jobs after successful insert', async () => {
      const file = makeFile(VALID_CSV, 'bank.csv');

      await service.importCsv('u1', file);

      expect(queue.add).toHaveBeenCalledTimes(3);
      const jobNames = (queue.add as jest.Mock).mock.calls.map(([name]) => name as string);
      expect(jobNames).toContain('embed-transactions');
      expect(jobNames).toContain('detect-subscriptions');
      expect(jobNames).toContain('compute-insights');
    });

    it('does not enqueue jobs when nothing was inserted', async () => {
      (prisma.transaction.create as jest.Mock).mockRejectedValue({ code: 'P2002' });
      const file = makeFile(VALID_CSV, 'bank.csv');

      await service.importCsv('u1', file);

      expect(queue.add).not.toHaveBeenCalled();
    });

    it('returns parse errors alongside insertion results', async () => {
      const csvWithBadRow = `date,merchant,amount,type
01/01/2025,Swiggy,350,debit
BADDATE,Netflix,abc,debit
03/01/2025,Salary,50000,credit`;

      const file = makeFile(csvWithBadRow, 'bank.csv');

      const result = await service.importCsv('u1', file);

      expect(result.inserted).toBe(2);
      expect(result.failed).toBe(1);
    });
  });
});
