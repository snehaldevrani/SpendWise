import { Injectable, BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import * as ExcelJS from 'exceljs';
import * as crypto from 'crypto';
import { TransactionCategory, TransactionType } from '@spendwise/shared-types';

export interface ParsedRow {
  date: Date;
  merchant: string;
  amount: number;
  currency: string;
  type: TransactionType;
  rawText: string;
  dedupKey: string;
  category: TransactionCategory;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: Array<{ row: number; message: string }>;
}

// Maps common CSV column aliases to canonical names
const COLUMN_MAP: Record<string, string> = {
  date: 'date',
  'transaction date': 'date',
  'txn date': 'date',
  'value date': 'date',
  'source date': 'date',
  merchant: 'merchant',
  description: 'merchant',
  narration: 'merchant',
  particulars: 'merchant',
  'transaction details': 'merchant',
  amount: 'amount',
  'debit amount': 'debit',
  'credit amount': 'credit',
  'withdrawal amt.': 'debit',
  'deposit amt.': 'credit',
  'withdrawal amount': 'debit',
  'deposit amount': 'credit',
  debit: 'debit',
  credit: 'credit',
  currency: 'currency',
  type: 'type',
};

const CATEGORY_RULES: Array<{ keywords: string[]; category: TransactionCategory }> = [
  { keywords: ['swiggy', 'zomato', 'restaurant', 'cafe', 'food', 'pizza', 'burger', 'eat', 'dining'], category: 'food' },
  { keywords: ['uber', 'ola', 'rapido', 'airline', 'flight', 'hotel', 'travel', 'train', 'bus', 'metro', 'irctc'], category: 'travel' },
  { keywords: ['electricity', 'water', 'gas', 'broadband', 'internet', 'wifi', 'mobile', 'recharge', 'bill', 'utility', 'jio', 'airtel', 'bsnl'], category: 'utilities' },
  { keywords: ['netflix', 'spotify', 'prime', 'hotstar', 'youtube', 'subscription', 'saas', 'adobe', 'github', 'openai', 'dropbox'], category: 'subscriptions' },
  { keywords: ['amazon', 'flipkart', 'myntra', 'meesho', 'shop', 'store', 'mall', 'retail'], category: 'shopping' },
  { keywords: ['hospital', 'pharmacy', 'clinic', 'doctor', 'medical', 'health', 'apollo', 'mediplus'], category: 'health' },
  { keywords: ['movie', 'theatre', 'pvr', 'inox', 'game', 'concert', 'event', 'entertainment'], category: 'entertainment' },
  { keywords: ['salary', 'credit', 'income', 'bonus', 'refund', 'cashback', 'interest earned'], category: 'income' },
];

function categorize(merchant: string): TransactionCategory {
  const lower = merchant.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.category;
    }
  }
  return 'other';
}

function normalizeHeaders(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of headers) {
    const canonical = COLUMN_MAP[h.trim().toLowerCase()];
    if (canonical) map[canonical] = h;
  }
  return map;
}

const MAX_ROWS = 10_000;
const MAX_COLS = 50;
const MAX_AMOUNT = 1_000_000_000;

function cellToString(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    if ('richText' in v) return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join('');
    if ('result' in v) {
      const r = (v as { result: unknown }).result;
      if (r instanceof Date) return r.toISOString().slice(0, 10);
      if (typeof r === 'object' && r !== null) return '';
      return String(r ?? '');
    }
    if ('text' in v) return String((v as { text: unknown }).text ?? '');
    if ('error' in v) return '';
  }
  return '';
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[^\d.-]/g, '');
  const value = parseFloat(cleaned);
  if (isNaN(value)) throw new Error(`Cannot parse amount: "${raw}"`);
  if (Math.abs(value) > MAX_AMOUNT) throw new Error('Amount exceeds maximum allowed value');
  return Math.abs(value);
}

function parseDate(raw: string): Date {
  const cleaned = raw.trim();

  // Excel serial number (e.g. 46118, 46118.5)
  if (/^\d{4,5}(\.\d+)?$/.test(cleaned)) {
    const serial = parseFloat(cleaned);
    const date = new Date((serial - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) return date;
  }

  // DD/MM/YY (2-digit year — HDFC format)
  const shortYear = cleaned.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{2})$/);
  if (shortYear) {
    const yy = parseInt(shortYear[3], 10);
    const year = yy >= 50 ? 1900 + yy : 2000 + yy;
    return new Date(`${year}-${shortYear[2]}-${shortYear[1]}`);
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = cleaned.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    return new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`);
  }

  // YYYY-MM-DD
  const iso = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return new Date(`${iso[1]}-${iso[2]}-${iso[3]}`);
  }

  const fallback = new Date(cleaned);
  if (isNaN(fallback.getTime())) throw new Error(`Cannot parse date: "${raw}"`);
  return fallback;
}

@Injectable()
export class CsvParserService {
  async parse(buffer: Buffer, filename?: string, password?: string): Promise<ParseResult> {
    let records: Record<string, string>[];

    const isExcel = filename && /\.xlsx$/i.test(filename);

    if (isExcel) {
      try {
        const workbook = new ExcelJS.Workbook();
        // ExcelJS declares Buffer as `extends ArrayBuffer`; newer @types/node uses Buffer<ArrayBufferLike>.
        // ExcelJS doesn't support password-encrypted xlsx; encrypted files are blocked earlier by magic-byte check.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await workbook.xlsx.load(buffer as any);
        const sheet = workbook.worksheets[0];
        if (!sheet) throw new BadRequestException('No worksheets found in file');

        const allRows: string[][] = [];
        sheet.eachRow({ includeEmpty: false }, (row) => {
          allRows.push((row.values as ExcelJS.CellValue[]).slice(1).map(cellToString));
        });

        if (allRows.length > MAX_ROWS) throw new BadRequestException(`File exceeds ${MAX_ROWS} row limit`);
        if ((allRows[0]?.length ?? 0) > MAX_COLS) throw new BadRequestException(`File exceeds ${MAX_COLS} column limit`);

        // Find the header row by scanning for known column names
        let headerIdx = -1;
        const knownHeaders = Object.keys(COLUMN_MAP);
        for (let i = 0; i < Math.min(30, allRows.length); i++) {
          const cells = allRows[i].map((c) => c.trim().toLowerCase());
          const matches = cells.filter((c) => knownHeaders.includes(c));
          if (matches.length >= 2) { headerIdx = i; break; }
        }

        if (headerIdx === -1) throw new BadRequestException('Could not find data headers in the file. Expected columns like Date, Narration, Amount.');

        const headers = allRows[headerIdx].map((c) => c.trim());
        const dataRows = allRows.slice(headerIdx + 1);

        // Skip separator rows (all asterisks or empty)
        records = dataRows
          .filter((row) => row.some((cell) => cell.trim() && !/^\*+$/.test(cell.trim())))
          .map((row) => {
            const obj: Record<string, string> = {};
            headers.forEach((h, idx) => { obj[h] = (row[idx] ?? '').trim(); });
            return obj;
          })
          .filter((obj) => Object.values(obj).some((v) => v && !/^\*+$/.test(v)));
      } catch (err) {
        const msg = (err as Error).message?.toLowerCase() ?? '';
        if (msg.includes('password') || msg.includes('decrypt') || msg.includes('incorrect')) {
          throw new BadRequestException('File is password-protected. Please provide the correct password.');
        }
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException('Could not parse Excel file');
      }
    } else {
      try {
        records = parse(buffer, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          to: MAX_ROWS,
        }) as Record<string, string>[];
      } catch {
        throw new BadRequestException('Invalid CSV file — could not parse');
      }
    }

    if (!records || records.length === 0) throw new BadRequestException('File is empty or has no data rows');

    const headers = Object.keys(records[0]);
    const colMap = normalizeHeaders(headers);

    const rows: ParsedRow[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    records.forEach((record, idx) => {
      const rowNum = idx + 2; // 1-indexed + header row
      try {
        const rawDate = record[colMap['date']];
        const rawMerchant = record[colMap['merchant']];
        const rawCurrency = record[colMap['currency']] ?? 'INR';

        if (!rawDate) throw new Error('Missing date column');

        const date = parseDate(rawDate);
        const merchant = rawMerchant?.trim() || 'Unknown';

        // Handle split debit/credit columns (some banks) vs single amount column
        let amount: number;
        let type: TransactionType;

        if (colMap['debit'] && record[colMap['debit']]?.trim()) {
          amount = parseAmount(record[colMap['debit']]);
          type = 'debit';
        } else if (colMap['credit'] && record[colMap['credit']]?.trim()) {
          amount = parseAmount(record[colMap['credit']]);
          type = 'credit';
        } else if (colMap['amount']) {
          const rawAmount = record[colMap['amount']];
          amount = parseAmount(rawAmount);
          const rawType = record[colMap['type']]?.trim().toLowerCase();
          type = rawType === 'credit' ? 'credit' : 'debit';
        } else {
          throw new Error('No amount column found');
        }

        const rawText = Object.values(record).join(' ').trim();
        const dedupKey = crypto
          .createHash('sha256')
          .update(`${date.toISOString()}|${merchant}|${amount}`)
          .digest('hex');

        rows.push({
          date,
          merchant,
          amount,
          currency: rawCurrency.trim() || 'INR',
          type,
          rawText,
          dedupKey,
          category: categorize(merchant),
        });
      } catch (err) {
        errors.push({ row: rowNum, message: (err as Error).message });
      }
    });

    return { rows, errors };
  }

  /**
   * Parse a digital (text-based) bank statement PDF.
   * Works with net banking exports — NOT scanned/image PDFs.
   * Looks for lines that begin with a date and contain decimal amounts.
   */
  async parsePdf(buffer: Buffer): Promise<ParseResult> {
    let pdfText: string;
    try {
      // pdf-parse is a CommonJS module
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
      const data = await pdfParse(buffer);
      pdfText = data.text;
    } catch {
      throw new BadRequestException(
        'Could not read PDF file. Please ensure it is a digital (not scanned) bank statement.',
      );
    }

    const rows: ParsedRow[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    const lines = pdfText.split('\n').map((l) => l.trim()).filter(Boolean);
    const dateRe = /^(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})/;
    let rowNum = 0;

    for (const line of lines) {
      if (rows.length >= MAX_ROWS) break;
      const dateMatch = line.match(dateRe);
      if (!dateMatch) continue;
      rowNum++;

      try {
        const date = parseDate(dateMatch[1]);
        const rest = line.slice(dateMatch[0].length).trim();

        // Find all decimal amounts (e.g. 1,234.56 or 250.95)
        const amountMatches = [...rest.matchAll(/(\d{1,3}(?:,\d{3})*\.\d{2})/g)];
        if (amountMatches.length === 0) continue;

        // First decimal number is the transaction amount; last is usually the running balance
        const rawAmount = amountMatches[0][0].replace(/,/g, '');
        const amount = parseFloat(rawAmount);
        if (isNaN(amount) || amount <= 0) continue;

        // Description = text before the first amount on this line
        const firstAmtIdx = rest.indexOf(amountMatches[0][0]);
        const merchant = (firstAmtIdx > 0 ? rest.slice(0, firstAmtIdx) : rest).trim() || 'Unknown';

        // Determine credit vs debit from CR/DR markers
        const upper = line.toUpperCase();
        const type: TransactionType =
          upper.includes(' CR') || upper.includes('CREDIT') ? 'credit' : 'debit';

        const dedupKey = crypto
          .createHash('sha256')
          .update(`${date.toISOString()}|${merchant}|${amount}`)
          .digest('hex');

        rows.push({
          date,
          merchant,
          amount,
          currency: 'INR',
          type,
          rawText: line,
          dedupKey,
          category: categorize(merchant),
        });
      } catch (err) {
        errors.push({ row: rowNum, message: (err as Error).message });
      }
    }

    if (rows.length === 0 && errors.length === 0) {
      throw new BadRequestException(
        'No transactions found in PDF. Ensure it is a digital bank statement with selectable text.',
      );
    }

    return { rows, errors };
  }
}
