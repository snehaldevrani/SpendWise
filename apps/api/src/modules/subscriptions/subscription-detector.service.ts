import { Injectable } from '@nestjs/common';

export interface DetectedSubscription {
  merchant: string;
  estimatedCycleDays: number;
  avgAmount: number;
  confidenceScore: number;
  lastChargeDate: Date;
  nextExpectedDate: Date;
}

interface TxnSample {
  date: Date;
  amount: number;
}

const KNOWN_CYCLES = [7, 14, 30, 90, 180, 365];
const MIN_OCCURRENCES = 2;
const CONFIDENCE_THRESHOLD = 0.4;

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function computeConfidence(intervals: number[], targetCycle: number): number {
  if (intervals.length === 0) return 0;
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const sd = stddev(intervals);

  // How close is the mean to a known cycle?
  const cycleDiff = Math.abs(mean - targetCycle) / targetCycle;
  const cycleFit = Math.max(0, 1 - cycleDiff * 2);

  // How consistent are the intervals? (lower stddev = higher confidence)
  const consistency = sd === 0 ? 1 : Math.max(0, 1 - sd / mean);

  // More occurrences = higher confidence
  const occurrenceFactor = Math.min(1, (intervals.length + 1) / 5);

  return Math.min(1, cycleFit * 0.4 + consistency * 0.4 + occurrenceFactor * 0.2);
}

function findBestCycle(intervals: number[]): { cycle: number; confidence: number } {
  let bestCycle = 30;
  let bestConfidence = 0;

  for (const cycle of KNOWN_CYCLES) {
    const confidence = computeConfidence(intervals, cycle);
    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestCycle = cycle;
    }
  }

  return { cycle: bestCycle, confidence: bestConfidence };
}

@Injectable()
export class SubscriptionDetectorService {
  detect(txnsByMerchant: Record<string, TxnSample[]>): DetectedSubscription[] {
    const results: DetectedSubscription[] = [];

    for (const [merchant, txns] of Object.entries(txnsByMerchant)) {
      if (txns.length < MIN_OCCURRENCES) continue;

      // Sort ascending by date
      const sorted = [...txns].sort((a, b) => a.date.getTime() - b.date.getTime());

      // Compute day intervals between consecutive transactions
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const diffDays =
          (sorted[i].date.getTime() - sorted[i - 1].date.getTime()) / (1000 * 60 * 60 * 24);
        intervals.push(Math.round(diffDays));
      }

      const { cycle, confidence } = findBestCycle(intervals);
      if (confidence < CONFIDENCE_THRESHOLD) continue;

      const amounts = sorted.map((t) => t.amount);
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const lastCharge = sorted[sorted.length - 1].date;
      const nextExpected = new Date(lastCharge.getTime() + cycle * 24 * 60 * 60 * 1000);

      results.push({
        merchant,
        estimatedCycleDays: cycle,
        avgAmount: Math.round(avgAmount * 100) / 100,
        confidenceScore: Math.round(confidence * 100) / 100,
        lastChargeDate: lastCharge,
        nextExpectedDate: nextExpected,
      });
    }

    return results.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }
}
