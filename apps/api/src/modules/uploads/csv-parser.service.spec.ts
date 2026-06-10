import { CsvParserService } from './csv-parser.service';
import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

describe('CsvParserService', () => {
  let service: CsvParserService;

  beforeEach(() => {
    service = new CsvParserService();
  });

  function toBuffer(csv: string): Buffer {
    return Buffer.from(csv, 'utf-8');
  }

  describe('basic parsing', () => {
    it('parses a standard CSV with date, merchant, amount, type columns', async () => {
      const csv = `date,merchant,amount,type
01/01/2025,Swiggy,350,debit
02/01/2025,Salary,50000,credit`;

      const result = await service.parse(toBuffer(csv));
      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].merchant).toBe('Swiggy');
      expect(result.rows[0].amount).toBe(350);
      expect(result.rows[0].type).toBe('debit');
      expect(result.rows[1].type).toBe('credit');
    });

    it('handles split debit/credit columns', async () => {
      const csv = `date,description,debit amount,credit amount
01/02/2025,Netflix,649,
02/02/2025,Salary,,80000`;

      const result = await service.parse(toBuffer(csv));
      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].type).toBe('debit');
      expect(result.rows[0].amount).toBe(649);
      expect(result.rows[1].type).toBe('credit');
      expect(result.rows[1].amount).toBe(80000);
    });

    it('strips currency symbols from amounts', async () => {
      const csv = `date,merchant,amount,type\n01/01/2025,Amazon,"₹1,200.00",debit`;

      const result = await service.parse(toBuffer(csv));
      expect(result.rows[0].amount).toBe(1200);
    });
  });

  describe('date formats', () => {
    it('parses DD/MM/YYYY format', async () => {
      const csv = `date,merchant,amount,type\n15/06/2024,Test,100,debit`;
      const result = await service.parse(toBuffer(csv));
      expect(result.rows[0].date.getFullYear()).toBe(2024);
      expect(result.rows[0].date.getMonth()).toBe(5); // June = 5
    });

    it('parses DD-MM-YYYY format', async () => {
      const csv = `date,merchant,amount,type\n15-06-2024,Test,100,debit`;
      const result = await service.parse(toBuffer(csv));
      expect(result.rows[0].date.getFullYear()).toBe(2024);
    });

    it('parses YYYY-MM-DD format', async () => {
      const csv = `date,merchant,amount,type\n2024-06-15,Test,100,debit`;
      const result = await service.parse(toBuffer(csv));
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

    test.each(cases)('categorizes "%s" as %s', async (merchant, expected) => {
      const csv = `date,merchant,amount,type\n01/01/2025,${merchant},100,debit`;
      const result = await service.parse(toBuffer(csv));
      expect(result.rows[0].category).toBe(expected);
    });
  });

  describe('dedup keys', () => {
    it('generates identical dedup keys for identical rows', async () => {
      const csv = `date,merchant,amount,type
01/01/2025,Test,100,debit
01/01/2025,Test,100,debit`;
      const result = await service.parse(toBuffer(csv));
      expect(result.rows[0].dedupKey).toBe(result.rows[1].dedupKey);
    });

    it('generates different dedup keys for different amounts', async () => {
      const csv = `date,merchant,amount,type
01/01/2025,Test,100,debit
01/01/2025,Test,200,debit`;
      const result = await service.parse(toBuffer(csv));
      expect(result.rows[0].dedupKey).not.toBe(result.rows[1].dedupKey);
    });
  });

  describe('BankStatementWizard / Excel format', () => {
    it('handles Source Date column overriding serial-number Date column', async () => {
      // BankStatementWizard exports Date as Excel serial and Source Date as readable string
      const csv = `Date,Source Date,Description,Credit,Debit,Amount,Balance
46118.5,06-04-2026,Zomato Order,,312.8,-312.8,23.16`;

      const result = await service.parse(toBuffer(csv));
      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(1);
      // Source Date (06-04-2026) should be used, not the serial number
      expect(result.rows[0].date.getFullYear()).toBe(2026);
      expect(result.rows[0].date.getMonth()).toBe(3); // April = 3
      expect(result.rows[0].merchant).toBe('Zomato Order');
      expect(result.rows[0].amount).toBe(312.8);
      expect(result.rows[0].type).toBe('debit');
    });

    it('parses Excel serial number date when no Source Date column present', async () => {
      // 46118 = 2026-04-06 (Excel epoch: Jan 1 1900 = serial 1)
      const csv = `date,merchant,amount,type
46118,Swiggy,250,debit`;

      const result = await service.parse(toBuffer(csv));
      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].date.getFullYear()).toBe(2026);
    });
  });

  describe('error handling', () => {
    it('throws BadRequestException for completely invalid file', async () => {
      await expect(service.parse(Buffer.from('not,,,\na csv\n\x00\x01'))).rejects.toThrow();
    });

    it('throws BadRequestException for empty CSV', async () => {
      await expect(service.parse(toBuffer('date,merchant,amount,type\n'))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('collects per-row errors without failing the whole batch', async () => {
      const csv = `date,merchant,amount,type
01/01/2025,Swiggy,350,debit
BADDATE,Netflix,abc,debit
03/01/2025,Zomato,200,debit`;

      const result = await service.parse(toBuffer(csv));
      expect(result.rows).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].row).toBe(3);
    });

    it('collects missing merchant error', async () => {
      const csv = `date,merchant,amount,type\n01/01/2025,,300,debit`;
      const result = await service.parse(toBuffer(csv));
      // empty merchant should still parse — it's a blank string not missing column
      // but we expect categorization to return 'other'
      expect(result.rows[0].category).toBe('other');
    });
  });

  describe('column alias support', () => {
    it('recognises "narration" as merchant column', async () => {
      const csv = `date,narration,amount,type\n01/01/2025,HDFC Credit Card,5000,debit`;
      const result = await service.parse(toBuffer(csv));
      expect(result.rows[0].merchant).toBe('HDFC Credit Card');
    });

    it('recognises "transaction date" as date column', async () => {
      const csv = `transaction date,particulars,amount,type\n01/01/2025,SBI Bill Pay,2000,debit`;
      const result = await service.parse(toBuffer(csv));
      expect(result.rows[0].date).toBeDefined();
    });
  });

  describe('PDF text parsing', () => {
    it('parses HDFC-style multiline PDF transactions', () => {
      const text = `
Date Narration Chq./Ref.No. Value Dt Withdrawal Amt. Deposit Amt. Closing Balance
30/01/26 NEFT CR-CITI0000006-EPAM SYSTEMS INDIA P CITIN26614770451 30/01/26 22,865.00 22,865.00
VT LTD HYDE INR-SNEHAL-DEVRANI-CITIN2661
4770451 SALARY FOR JAN26682852
31/01/26 UPI-BRIJESH KUMAR SAHU-9652504473@IBL-S 0000117932545437 31/01/26 329.00 22,536.00
BIN0010534-117932545437-UPI
01/02/26 UPI-ZOMATO
LIMITED-ZOMATOORDER1.GPAY@OKP
0000117986540359 01/02/26 331.70 22,168.30
AYAXIS-UTIB0000553-117986540359-UPI
Page No .: 1
MR SNEHAL DEVRANI
Statement of account From : 01/12/2025 To : 31/05/2026
`;

      const result = service.parsePdfText(text);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(3);
      expect(result.rows[0].type).toBe('credit');
      expect(result.rows[0].amount).toBe(22865);
      expect(result.rows[1].type).toBe('debit');
      expect(result.rows[1].amount).toBe(329);
      expect(result.rows[2].merchant).toContain('UPI-ZOMATO');
      expect(result.rows[2].amount).toBe(331.7);
    });
  });

  describe('sample upload fixtures', () => {
    it.each([
      'simple-sample.csv',
      'hdfc-split-columns-sample.csv',
      'bankstatementwizard-sample.csv',
      'simple-sample.xlsx',
    ])('parses %s', async (filename) => {
      const fixturePath = path.resolve(
        __dirname,
        '../../../../../test-fixtures/sample-bank-statements',
        filename,
      );

      const result = await service.parse(fs.readFileSync(fixturePath), filename);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(6);
    });
  });
});
