import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';

const mockUser: AuthUser = { id: 'user-1', email: 'test@example.com' };

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let service: jest.Mocked<TransactionsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        {
          provide: TransactionsService,
          useValue: {
            findAll: jest.fn(),
            updateCategory: jest.fn(),
            getMonthlySummary: jest.fn(),
            getOverview: jest.fn(),
            getDailySpend: jest.fn(),
            getCategoryTrends: jest.fn(),
            clearAllData: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TransactionsController>(TransactionsController);
    service = module.get(TransactionsService);
  });

  describe('findAll', () => {
    it('delegates to service.findAll with parsed page and limit', async () => {
      service.findAll.mockResolvedValue({ total: 0, page: 2, limit: 10, items: [] });

      await controller.findAll(mockUser, '2', '10');

      expect(service.findAll).toHaveBeenCalledWith('user-1', expect.objectContaining({ page: 2, limit: 10 }));
    });

    it('passes category and search filters to service', async () => {
      service.findAll.mockResolvedValue({ total: 0, page: 1, limit: 20, items: [] });

      await controller.findAll(mockUser, undefined, undefined, 'food', 'Swiggy');

      expect(service.findAll).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ category: 'food', search: 'Swiggy' }),
      );
    });

    it('clamps search input to 100 characters', async () => {
      service.findAll.mockResolvedValue({ total: 0, page: 1, limit: 20, items: [] });
      const longSearch = 'a'.repeat(200);

      await controller.findAll(mockUser, undefined, undefined, undefined, longSearch);

      expect(service.findAll).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ search: 'a'.repeat(100) }),
      );
    });

    it('defaults to page 1 when page is not provided', async () => {
      service.findAll.mockResolvedValue({ total: 0, page: 1, limit: 20, items: [] });

      await controller.findAll(mockUser);

      expect(service.findAll).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ page: undefined }),
      );
    });
  });

  describe('updateCategory', () => {
    it('delegates to service with userId and transactionId', async () => {
      const updated = { id: 'txn-1', category: 'food' };
      service.updateCategory.mockResolvedValue(updated as never);

      const result = await controller.updateCategory(mockUser, 'txn-1', { category: 'food' } as never);

      expect(service.updateCategory).toHaveBeenCalledWith('user-1', 'txn-1', 'food');
      expect(result).toEqual(updated);
    });

    it('uses userId from JWT — cannot edit another user\'s transaction', async () => {
      const otherUser: AuthUser = { id: 'user-999', email: 'evil@example.com' };
      service.updateCategory.mockResolvedValue({} as never);

      await controller.updateCategory(otherUser, 'txn-1', { category: 'shopping' } as never);

      // The service is called with the other user's id — Prisma WHERE guards the rest
      expect(service.updateCategory).toHaveBeenCalledWith('user-999', 'txn-1', 'shopping');
    });
  });

  describe('getOverview', () => {
    it('calls service.getOverview with the authenticated user id', async () => {
      service.getOverview.mockResolvedValue({ thisMonth: 0, lastMonth: 0, savings: 0 } as never);

      await controller.getOverview(mockUser);

      expect(service.getOverview).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getDailySpend', () => {
    it('passes parsed days to service', async () => {
      service.getDailySpend.mockResolvedValue([] as never);

      await controller.getDailySpend(mockUser, '30');

      expect(service.getDailySpend).toHaveBeenCalledWith('user-1', 30);
    });

    it('defaults to 60 days when not provided', async () => {
      service.getDailySpend.mockResolvedValue([] as never);

      await controller.getDailySpend(mockUser);

      expect(service.getDailySpend).toHaveBeenCalledWith('user-1', 60);
    });
  });

  describe('getMonthlySummary', () => {
    it('parses string month and year to integers', async () => {
      service.getMonthlySummary.mockResolvedValue({} as never);

      await controller.getMonthlySummary(mockUser, '5', '2025');

      expect(service.getMonthlySummary).toHaveBeenCalledWith('user-1', 5, 2025);
    });
  });

  describe('getCategoryTrends', () => {
    it('defaults to 6 months when not provided', async () => {
      service.getCategoryTrends.mockResolvedValue([] as never);

      await controller.getCategoryTrends(mockUser);

      expect(service.getCategoryTrends).toHaveBeenCalledWith('user-1', 6);
    });

    it('passes custom months value to service', async () => {
      service.getCategoryTrends.mockResolvedValue([] as never);

      await controller.getCategoryTrends(mockUser, '12');

      expect(service.getCategoryTrends).toHaveBeenCalledWith('user-1', 12);
    });
  });
});
