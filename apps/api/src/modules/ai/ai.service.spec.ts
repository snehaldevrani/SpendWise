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
    SchemaType: { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER', BOOLEAN: 'BOOLEAN', ARRAY: 'ARRAY' },
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
      budget: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as unknown as jest.Mocked<PrismaService>;

    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      incr: jest.fn().mockResolvedValue(1), // below rate limit by default
    } as unknown as jest.Mocked<CacheService>;

    const config = { get: jest.fn().mockReturnValue('test-api-key') } as unknown as ConfigService;
    const customCategories = { list: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn(), delete: jest.fn() } as never;
    const budgets = { upsertBudget: jest.fn(), deleteBudget: jest.fn() } as never;

    mockGenerateContent.mockReset();

    service = new AiService(prisma, config, cache, customCategories, budgets);
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
    const noFunctionCalls = () => undefined;

    it('throws 429 when chat rate limit is exceeded', async () => {
      (cache.incr as jest.Mock).mockResolvedValue(21); // over 20/day limit

      await expect(service.chat('user-1', 'What is my biggest expense?', [])).rejects.toThrow(
        HttpException,
      );
    });

    it('returns the AI answer and empty actionsPerformed on plain text response', async () => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => 'Your top expense is food (₹5,200).', functionCalls: noFunctionCalls },
      });

      const result = await service.chat('user-1', 'Top expense?', ['txn: food 500']);

      expect(result.answer).toBe('Your top expense is food (₹5,200).');
      expect(result.actionsPerformed).toEqual([]);
    });

    it('includes context chunks in the first-turn prompt', async () => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => 'Based on your data...', functionCalls: noFunctionCalls },
      });

      await service.chat('user-1', 'What did I spend on food?', ['txn: Swiggy 350', 'txn: Zomato 200']);

      const callArg = mockGenerateContent.mock.calls[0][0] as { contents: Array<{ parts: Array<{ text: string }> }> };
      const firstUserText = callArg.contents[callArg.contents.length - 1].parts[0].text;
      expect(firstUserText).toContain('Swiggy');
      expect(firstUserText).toContain('Zomato');
    });

    it('sends the question without context when no chunks provided', async () => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => 'Not enough data.', functionCalls: noFunctionCalls },
      });

      await service.chat('user-1', 'Any subscriptions?', []);

      const callArg = mockGenerateContent.mock.calls[0][0] as { contents: Array<{ parts: Array<{ text: string }> }> };
      const firstUserText = callArg.contents[callArg.contents.length - 1].parts[0].text;
      expect(firstUserText).not.toContain('Additional semantic matches');
      expect(firstUserText).toContain('Any subscriptions?');
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
        response: { text: () => 'Your top expense is food.', functionCalls: noFunctionCalls },
      });

      await service.chat('user-1', 'What did I spend on food?', []);

      const callArg = mockGenerateContent.mock.calls[0][0] as { contents: Array<{ parts: Array<{ text: string }> }> };
      const firstUserText = callArg.contents[callArg.contents.length - 1].parts[0].text;
      expect(firstUserText).toContain('Zomato');
      expect(firstUserText).toContain('Himanshi');
      expect(firstUserText).not.toContain('013914520250');
      expect(firstUserText).not.toContain('609779342132');
      expect(firstUserText).not.toContain('UPIAR/');
      expect(firstUserText).not.toContain('UPIAB/');
    });
  });
});
