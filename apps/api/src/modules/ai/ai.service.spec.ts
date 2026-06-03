import { AiService } from './ai.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../common/cache/cache.service';
import { ServiceUnavailableException, HttpException } from '@nestjs/common';

// Mock the Google Generative AI SDK so no real API calls are made
const mockGenerateContent = jest.fn();

jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: mockGenerateContent,
      }),
    })),
  };
});

function makeValidRecommendation() {
  return {
    topLeaks: [{ merchant: 'Netflix', reason: 'Unused', estimatedMonthlySavings: 649 }],
    estimatedMonthlySavings: 649,
    actionChecklist: ['Cancel Netflix', 'Review Spotify', 'Check Amazon Prime', 'Audit Adobe', 'Review gym'],
    uncertaintyNotes: 'Based on last 30 days only',
  };
}

describe('AiService', () => {
  let service: AiService;
  let prisma: jest.Mocked<PrismaService>;
  let cache: jest.Mocked<CacheService>;

  beforeEach(async () => {
    prisma = {
      transaction: { findMany: jest.fn().mockResolvedValue([]) },
      subscription: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as jest.Mocked<PrismaService>;

    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      incr: jest.fn().mockResolvedValue(1), // below rate limit by default
    } as unknown as jest.Mocked<CacheService>;

    const config = { get: jest.fn().mockReturnValue('test-api-key') } as unknown as ConfigService;

    mockGenerateContent.mockReset();

    service = new AiService(prisma, config, cache);
  });

  describe('getRecommendations', () => {
    it('returns cached result when cache hit', async () => {
      const cached = makeValidRecommendation();
      (cache.get as jest.Mock).mockResolvedValue(cached);

      const result = await service.getRecommendations('user-1');

      expect(result).toEqual(cached);
    });

    it('throws 429 when per-user rate limit is exceeded', async () => {
      (cache.incr as jest.Mock).mockResolvedValue(5); // over the 4/day limit
      (cache.get as jest.Mock).mockResolvedValue(null);

      await expect(service.getRecommendations('user-1')).rejects.toThrow(HttpException);
    });

    it('stores result in cache on successful API call', async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);
      const rec = makeValidRecommendation();

      mockGenerateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(rec) },
      });

      const result = await service.getRecommendations('user-1');

      expect(cache.set).toHaveBeenCalledWith(`ai:recs:user-1`, rec, expect.any(Number));
      expect(result.topLeaks).toEqual(rec.topLeaks);
      expect(result.estimatedMonthlySavings).toBe(649);
    });

    it('throws ServiceUnavailableException on malformed AI response', async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);

      mockGenerateContent.mockResolvedValue({
        response: { text: () => '{ "bad": "json missing required fields" }' },
      });

      await expect(service.getRecommendations('user-1')).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('bustRecommendationsCache', () => {
    it('deletes the correct cache key', async () => {
      await service.bustRecommendationsCache('user-42');

      expect(cache.del).toHaveBeenCalledWith('ai:recs:user-42');
    });
  });

  describe('chat', () => {
    it('throws 429 when chat rate limit is exceeded', async () => {
      (cache.incr as jest.Mock).mockResolvedValue(21); // over 20/day limit

      await expect(service.chat('user-1', 'What is my biggest expense?', [])).rejects.toThrow(
        HttpException,
      );
    });

    it('returns the AI answer string', async () => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => 'Your top expense is food (₹5,200).' },
      });

      const answer = await service.chat('user-1', 'Top expense?', ['txn: food 500']);

      expect(answer).toBe('Your top expense is food (₹5,200).');
    });

    it('includes context chunks in the prompt', async () => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => 'Based on your data...' },
      });

      await service.chat('user-1', 'What did I spend on food?', ['txn: Swiggy 350', 'txn: Zomato 200']);

      const callArg: string = mockGenerateContent.mock.calls[0][0];
      expect(callArg).toContain('Swiggy');
      expect(callArg).toContain('Zomato');
    });

    it('sends the question without context when no chunks provided', async () => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => 'Not enough data.' },
      });

      await service.chat('user-1', 'Any subscriptions?', []);

      const callArg: string = mockGenerateContent.mock.calls[0][0];
      expect(callArg).not.toContain('Additional semantic matches');
      expect(callArg).toContain('Any subscriptions?');
    });

    it('strips UPI reference IDs from merchant names before sending to Gemini', async () => {
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
        {
          merchant: 'UPIAR/013914520250/DR/Zomato/UTIB',
          amount: 312.8,
          category: 'food',
          date: new Date('2026-04-06'),
          type: 'debit',
        },
        {
          merchant: 'UPIAB/609779342132/CR/Himanshi/SBIN',
          amount: 145,
          category: 'income',
          date: new Date('2026-04-07'),
          type: 'credit',
        },
      ]);

      mockGenerateContent.mockResolvedValue({
        response: { text: () => 'Your top expense is food.' },
      });

      await service.chat('user-1', 'What did I spend on food?', []);

      const callArg: string = mockGenerateContent.mock.calls[0][0];
      // Brand names should be present
      expect(callArg).toContain('Zomato');
      expect(callArg).toContain('Himanshi');
      // Raw UPI reference IDs must NOT be sent to Gemini
      expect(callArg).not.toContain('013914520250');
      expect(callArg).not.toContain('609779342132');
      expect(callArg).not.toContain('UPIAR/');
      expect(callArg).not.toContain('UPIAB/');
    });
  });
});
