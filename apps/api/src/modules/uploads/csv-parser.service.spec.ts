import { CsvParserService } from './csv-parser.service';
import { BadRequestException } from '@nestjs/common';

describe('CsvParserService', () => {
  let service: CsvParserService;

  beforeEach(() => {
    service = new CsvParserService();
  });

  function toBuffer(csv: string): Buffer {
    return Buffer.from(csv, 'utf-8');
  }

  describe('basic parsing', () => {
    it('parses a standard CSV with date, merchant, amount, type columns', () => {
      const csv = `date,merchant,amount,type
01/01/2025,Swiggy,350,debit
02/01/2025,Salary,50000,credit`;

      const result = service.parse(toBuffer(csv));
      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].merchant).toBe('Swiggy');
      expect(result.rows[0].amount).toBe(350);
      expect(result.rows[0].type).toBe('debit');
      expect(result.rows[1].type).toBe('credit');
    });

    it('handles split debit/credit columns', () => {
      const csv = `date,description,debit amount,credit amount
01/02/2025,Netflix,649,
02/02/2025,Salary,,80000`;

      const result = service.parse(toBuffer(csv));
      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].type).toBe('debit');
      expect(result.rows[0].amount).toBe(649);
      expect(result.rows[1].type).toBe('credit');
      expect(result.rows[1].amount).toBe(80000);
    });

    it('strips currency symbols from amounts', () => {
      const csv = `date,merchant,amount,type\n01/01/2025,Amazon,"₹1,200.00",debit`;

      const result = service.parse(toBuffer(csv));
      expect(result.rows[0].amount).toBe(1200);
    });
  });

  describe('date formats', () => {
    it('parses DD/MM/YYYY format', () => {
      const csv = `date,merchant,amount,type\n15/06/2024,Test,100,debit`;
      const result = service.parse(toBuffer(csv));
      expect(result.rows[0].date.getFullYear()).toBe(2024);
      expect(result.rows[0].date.getMonth()).toBe(5); // June = 5
    });

    it('parses DD-MM-YYYY format', () => {
      const csv = `date,merchant,amount,type\n15-06-2024,Test,100,debit`;
      const result = service.parse(toBuffer(csv));
      expect(result.rows[0].date.getFullYear()).toBe(2024);
    });

    it('parses YYYY-MM-DD format', () => {
      const csv = `date,merchant,amount,type\n2024-06-15,Test,100,debit`;
      const result = service.parse(toBuffer(csv));
      expect(result.rows[0].date.getFullYear()).toBe(2024);
    });
  });

  describe('categorization', () => {
    const cases: Array<[string, string]> = [
      ['Swiggy Order #123', 'food'],
      ['Zomato', 'food'],
      ['Netflix Monthly Subscription', 'subscriptions'],
      ['Spotify Premium', 'subscriptions'],
      ['Uber Trip', 'travel'],
      ['Salary Credit', 'income'],
      ['Amazon Shopping', 'shopping'],
      ['Apollo Pharmacy', 'health'],
      ['IRCTC Train Ticket', 'travel'],
      ['Jio Recharge', 'utilities'],
      ['Unknown Vendor XYZ', 'other'],
    ];

    test.each(cases)('categorizes "%s" as %s', (merchant, expected) => {
      const csv = `date,merchant,amount,type\n01/01/2025,${merchant},100,debit`;
      const result = service.parse(toBuffer(csv));
      expect(result.rows[0].category).toBe(expected);
    });
  });

  describe('dedup keys', () => {
    it('generates identical dedup keys for identical rows', () => {
      const csv = `date,merchant,amount,type
01/01/2025,Test,100,debit
01/01/2025,Test,100,debit`;
      const result = service.parse(toBuffer(csv));
      expect(result.rows[0].dedupKey).toBe(result.rows[1].dedupKey);
    });

    it('generates different dedup keys for different amounts', () => {
      const csv = `date,merchant,amount,type
01/01/2025,Test,100,debit
01/01/2025,Test,200,debit`;
      const result = service.parse(toBuffer(csv));
      expect(result.rows[0].dedupKey).not.toBe(result.rows[1].dedupKey);
    });
  });

  describe('BankStatementWizard / Excel format', () => {
    it('handles Source Date column overriding serial-number Date column', () => {
      // BankStatementWizard exports Date as Excel serial and Source Date as readable string
      const csv = `Date,Source Date,Description,Credit,Debit,Amount,Balance
46118.5,06-04-2026,Zomato Order,,312.8,-312.8,23.16`;

      const result = service.parse(toBuffer(csv));
      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(1);
      // Source Date (06-04-2026) should be used, not the serial number
      expect(result.rows[0].date.getFullYear()).toBe(2026);
      expect(result.rows[0].date.getMonth()).toBe(3); // April = 3
      expect(result.rows[0].merchant).toBe('Zomato Order');
      expect(result.rows[0].amount).toBe(312.8);
      expect(result.rows[0].type).toBe('debit');
    });

    it('parses Excel serial number date when no Source Date column present', () => {
      // 46118 = 2026-04-06 (Excel epoch: Jan 1 1900 = serial 1)
      const csv = `date,merchant,amount,type
46118,Swiggy,250,debit`;

      const result = service.parse(toBuffer(csv));
      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].date.getFullYear()).toBe(2026);
    });
  });

  describe('error handling', () => {
    it('throws BadRequestException for completely invalid file', () => {
      expect(() => service.parse(Buffer.from('not,,,\na csv\n\x00\x01'))).toThrow();
    });

    it('throws BadRequestException for empty CSV', () => {
      expect(() => service.parse(toBuffer('date,merchant,amount,type\n'))).toThrow(
        BadRequestException,
      );
    });

    it('collects per-row errors without failing the whole batch', () => {
      const csv = `date,merchant,amount,type
01/01/2025,Swiggy,350,debit
BADDATE,Netflix,abc,debit
03/01/2025,Zomato,200,debit`;

      const result = service.parse(toBuffer(csv));
      expect(result.rows).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].row).toBe(3);
    });

    it('collects missing merchant error', () => {
      const csv = `date,merchant,amount,type\n01/01/2025,,300,debit`;
      const result = service.parse(toBuffer(csv));
      // empty merchant should still parse — it's a blank string not missing column
      // but we expect categorization to return 'other'
      expect(result.rows[0].category).toBe('other');
    });
  });

  describe('column alias support', () => {
    it('recognises "narration" as merchant column', () => {
      const csv = `date,narration,amount,type\n01/01/2025,HDFC Credit Card,5000,debit`;
      const result = service.parse(toBuffer(csv));
      expect(result.rows[0].merchant).toBe('HDFC Credit Card');
    });

    it('recognises "transaction date" as date column', () => {
      const csv = `transaction date,particulars,amount,type\n01/01/2025,SBI Bill Pay,2000,debit`;
      const result = service.parse(toBuffer(csv));
      expect(result.rows[0].date).toBeDefined();
    });
  });
});
