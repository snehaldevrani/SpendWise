import { Injectable, BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
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

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[^\d.-]/g, '');
  const value = parseFloat(cleaned);
  if (isNaN(value)) throw new Error(`Cannot parse amount: "${raw}"`);
  return Math.abs(value);
}

function parseDate(raw: string): Date {
  const cleaned = raw.trim();

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
  parse(buffer: Buffer, filename?: string, password?: string): ParseResult {
    let records: Record<string, string>[];

    const isExcel = filename && /\.(xlsx?|xls)$/i.test(filename);

    if (isExcel) {
      try {
        const wb = XLSX.read(buffer, { type: 'buffer', password: password || undefined });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });

        // Find the header row by scanning for known column names
        let headerIdx = -1;
        const knownHeaders = Object.keys(COLUMN_MAP);
        for (let i = 0; i < Math.min(30, allRows.length); i++) {
          const cells = allRows[i].map((c) => String(c).trim().toLowerCase());
          const matches = cells.filter((c) => knownHeaders.includes(c));
          if (matches.length >= 2) { headerIdx = i; break; }
        }

        if (headerIdx === -1) throw new BadRequestException('Could not find data headers in the file. Expected columns like Date, Narration, Amount.');

        const headers = allRows[headerIdx].map((c) => String(c).trim());
        const dataRows = allRows.slice(headerIdx + 1);

        // Skip separator rows (all asterisks or empty)
        records = dataRows
          .filter((row) => row.some((cell) => String(cell).trim() && !/^\*+$/.test(String(cell).trim())))
          .map((row) => {
            const obj: Record<string, string> = {};
            headers.forEach((h, idx) => { obj[h] = String(row[idx] ?? '').trim(); });
            return obj;
          })
          .filter((obj) => Object.values(obj).some((v) => v && !/^\*+$/.test(v)));
      } catch (err) {
        const msg = (err as Error).message || '';
        if (msg.includes('password')) throw new BadRequestException('File is password-protected. Please provide the correct password.');
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException('Could not parse Excel file');
      }
    } else {
      try {
        records = parse(buffer, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
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
}
