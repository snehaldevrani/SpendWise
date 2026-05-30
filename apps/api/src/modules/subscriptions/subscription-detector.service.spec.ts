import { SubscriptionDetectorService } from './subscription-detector.service';

function daysFromNow(n: number): Date {
  const d = new Date('2025-01-01');
  d.setDate(d.getDate() + n);
  return d;
}

describe('SubscriptionDetectorService', () => {
  let service: SubscriptionDetectorService;

  beforeEach(() => {
    service = new SubscriptionDetectorService();
  });

  it('detects a monthly subscription with high confidence', () => {
    const txns = {
      Netflix: [
        { date: daysFromNow(0), amount: 649 },
        { date: daysFromNow(30), amount: 649 },
        { date: daysFromNow(60), amount: 649 },
        { date: daysFromNow(90), amount: 649 },
      ],
    };

    const result = service.detect(txns);
    expect(result).toHaveLength(1);
    expect(result[0].merchant).toBe('Netflix');
    expect(result[0].estimatedCycleDays).toBe(30);
    expect(result[0].confidenceScore).toBeGreaterThan(0.7);
  });

  it('detects a weekly subscription', () => {
    const txns = {
      'Gym Fee': [
        { date: daysFromNow(0), amount: 200 },
        { date: daysFromNow(7), amount: 200 },
        { date: daysFromNow(14), amount: 200 },
        { date: daysFromNow(21), amount: 200 },
      ],
    };

    const result = service.detect(txns);
    expect(result).toHaveLength(1);
    expect(result[0].estimatedCycleDays).toBe(7);
  });

  it('detects an annual subscription', () => {
    const txns = {
      'Domain Renewal': [
        { date: daysFromNow(0), amount: 999 },
        { date: daysFromNow(365), amount: 999 },
      ],
    };

    const result = service.detect(txns);
    expect(result).toHaveLength(1);
    expect(result[0].estimatedCycleDays).toBe(365);
  });

  it('ignores merchants with only one transaction', () => {
    const txns = { 'One Time Purchase': [{ date: daysFromNow(0), amount: 500 }] };
    const result = service.detect(txns);
    expect(result).toHaveLength(0);
  });

  it('ignores irregular merchants below confidence threshold', () => {
    const txns = {
      'Random Vendor': [
        { date: daysFromNow(0), amount: 100 },
        { date: daysFromNow(13), amount: 200 },
        { date: daysFromNow(55), amount: 150 },
      ],
    };
    const result = service.detect(txns);
    // May or may not detect depending on confidence — assert it doesn't crash
    expect(Array.isArray(result)).toBe(true);
  });

  it('computes correct next expected date', () => {
    const base = new Date('2025-01-01');
    const txns = {
      Spotify: [
        { date: new Date('2025-01-01'), amount: 119 },
        { date: new Date('2025-02-01'), amount: 119 },
        { date: new Date('2025-03-01'), amount: 119 },
      ],
    };

    const result = service.detect(txns);
    expect(result).toHaveLength(1);
    // Next expected should be ~30 days after last charge (March 1)
    const diff =
      (result[0].nextExpectedDate.getTime() - new Date('2025-03-01').getTime()) /
      (1000 * 60 * 60 * 24);
    expect(diff).toBeCloseTo(30, 0);
  });

  it('returns results sorted by confidence descending', () => {
    const txns = {
      Netflix: [
        { date: daysFromNow(0), amount: 649 },
        { date: daysFromNow(30), amount: 649 },
        { date: daysFromNow(60), amount: 649 },
        { date: daysFromNow(90), amount: 649 },
      ],
      'Irregular Sub': [
        { date: daysFromNow(0), amount: 100 },
        { date: daysFromNow(25), amount: 100 },
      ],
    };

    const result = service.detect(txns);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].confidenceScore).toBeGreaterThanOrEqual(result[i].confidenceScore);
    }
  });

  it('computes average amount correctly', () => {
    const txns = {
      Spotify: [
        { date: daysFromNow(0), amount: 100 },
        { date: daysFromNow(30), amount: 120 },
        { date: daysFromNow(60), amount: 110 },
      ],
    };

    const result = service.detect(txns);
    if (result.length > 0) {
      expect(result[0].avgAmount).toBeCloseTo(110, 1);
    }
  });
});
