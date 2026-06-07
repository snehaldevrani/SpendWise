import { UploadsService } from './uploads.service';
import { CsvParserService } from './csv-parser.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { BadRequestException } from '@nestjs/common';
import { Queue } from 'bullmq';

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

  describe('importCsv — file type validation', () => {
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

  describe('importCsv — magic byte validation', () => {
    it('throws BadRequestException if .xlsx file does not have ZIP magic bytes', async () => {
      // Fake xlsx: wrong magic bytes (just plain text)
      const fakeXlsx = makeFile('PK fake content', 'bank.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      // Overwrite buffer with non-ZIP bytes
      fakeXlsx.buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);

      await expect(service.importCsv('u1', fakeXlsx)).rejects.toThrow(BadRequestException);
      await expect(service.importCsv('u1', fakeXlsx)).rejects.toThrow('XLSX format');
    });

  });

  describe('importCsv — full flow', () => {
    it('clears existing subscriptions and transactions before inserting', async () => {
      const file = makeFile(VALID_CSV, 'bank.csv');

      await service.importCsv('u1', file);

      expect(prisma.subscription.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(prisma.transaction.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    });

    it('inserts all valid parsed rows', async () => {
      const file = makeFile(VALID_CSV, 'bank.csv');

      const result = await service.importCsv('u1', file);

      // 3 rows, all valid
      expect(result.inserted).toBe(3);
      expect(result.skipped).toBe(0);
      expect(result.failed).toBe(0);
      expect(prisma.transaction.create).toHaveBeenCalledTimes(3);
    });

    it('skips duplicate rows (unique constraint violation)', async () => {
      (prisma.transaction.create as jest.Mock)
        .mockResolvedValueOnce({}) // first row succeeds
        .mockRejectedValueOnce({ code: 'P2002' }) // second row is duplicate
        .mockResolvedValueOnce({}); // third succeeds

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
      // Make all creates fail as duplicates
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
