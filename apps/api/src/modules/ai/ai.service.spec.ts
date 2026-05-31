import { AiService } from './ai.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../common/cache/cache.service';
import { ServiceUnavailableException, HttpException } from '@nestjs/common';

// Mock the Anthropic SDK so no real API calls are made
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn(),
      },
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

      // Mock the anthropic client on the service instance directly
      const client = (service as unknown as { client: { messages: { create: jest.Mock } } }).client;
      client.messages.create = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(rec) }],
      });

      const result = await service.getRecommendations('user-1');

      expect(cache.set).toHaveBeenCalledWith(`ai:recs:user-1`, rec, expect.any(Number));
      expect(result.topLeaks).toEqual(rec.topLeaks);
      expect(result.estimatedMonthlySavings).toBe(649);
    });

    it('throws ServiceUnavailableException on malformed AI response', async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);

      const client = (service as unknown as { client: { messages: { create: jest.Mock } } }).client;
      client.messages.create = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{ "bad": "json missing required fields" }' }],
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
      const client = (service as unknown as { client: { messages: { create: jest.Mock } } }).client;
      client.messages.create = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Your top expense is food (₹5,200).' }],
      });

      const answer = await service.chat('user-1', 'Top expense?', ['txn: food 500']);

      expect(answer).toBe('Your top expense is food (₹5,200).');
    });

    it('includes context chunks in the prompt', async () => {
      const client = (service as unknown as { client: { messages: { create: jest.Mock } } }).client;
      const mockCreate = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Based on your data...' }],
      });
      client.messages.create = mockCreate;

      await service.chat('user-1', 'What did I spend on food?', ['txn: Swiggy 350', 'txn: Zomato 200']);

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages[0].content as string;
      expect(userMessage).toContain('Swiggy');
      expect(userMessage).toContain('Zomato');
    });

    it('sends the question without context when no chunks provided', async () => {
      const client = (service as unknown as { client: { messages: { create: jest.Mock } } }).client;
      const mockCreate = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Not enough data.' }],
      });
      client.messages.create = mockCreate;

      await service.chat('user-1', 'Any subscriptions?', []);

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages[0].content as string;
      // No context prefix when chunks are empty
      expect(userMessage).not.toContain('Relevant transaction history');
      expect(userMessage).toContain('Any subscriptions?');
    });
  });
});
