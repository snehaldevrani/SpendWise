import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('mock-token'),
  verify: jest.fn(),
};

const mockConfig = {
  get: jest.fn().mockReturnValue('mock-secret'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('creates a new user and returns tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'user-1', email: 'test@test.com' });
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.signup({ email: 'test@test.com', password: 'password123' });

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: 'test@test.com' }) }),
      );
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('throws ConflictException if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.signup({ email: 'taken@test.com', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('hashes the password before storing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'user-1', email: 'test@test.com' });
      mockPrisma.refreshToken.create.mockResolvedValue({});

      await service.signup({ email: 'test@test.com', password: 'mypassword' });

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.passwordHash).not.toBe('mypassword');
      const isHashed = await bcrypt.compare('mypassword', createCall.data.passwordHash);
      expect(isHashed).toBe(true);
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      const hash = await bcrypt.hash('correctpassword', 12);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.com',
        passwordHash: hash,
      });
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({ email: 'user@test.com', password: 'correctpassword' });
      expect(result).toHaveProperty('accessToken');
    });

    it('throws UnauthorizedException for unknown email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const hash = await bcrypt.hash('realpassword', 12);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.com',
        passwordHash: hash,
      });

      await expect(
        service.login({ email: 'user@test.com', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('issues new tokens for a valid refresh token', async () => {
      const rawToken = 'valid-refresh-jwt';
      const tokenHash = await bcrypt.hash(rawToken, 10);

      mockJwt.verify.mockReturnValue({ sub: 'user-1', email: 'user@test.com' });
      mockPrisma.refreshToken.findMany.mockResolvedValue([
        { id: 'rt-1', tokenHash },
      ]);
      mockPrisma.refreshToken.delete.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'user@test.com' });
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh(rawToken);
      expect(result).toHaveProperty('accessToken');
      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt-1' } });
    });

    it('throws UnauthorizedException for an expired/invalid JWT', async () => {
      mockJwt.verify.mockImplementation(() => { throw new Error('jwt expired'); });
      await expect(service.refresh('expired-jwt')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when no hash matches', async () => {
      mockJwt.verify.mockReturnValue({ sub: 'user-1', email: 'user@test.com' });
      mockPrisma.refreshToken.findMany.mockResolvedValue([]);
      await expect(service.refresh('unknown-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('deletes the matching refresh token by id', async () => {
      const rawToken = 'some-refresh-jwt';
      const tokenHash = await bcrypt.hash(rawToken, 10);

      mockJwt.verify.mockReturnValue({ sub: 'user-1', email: 'user@test.com' });
      mockPrisma.refreshToken.findMany.mockResolvedValue([
        { id: 'rt-42', tokenHash },
      ]);
      mockPrisma.refreshToken.delete.mockResolvedValue({});

      await service.logout(rawToken);
      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt-42' } });
    });

    it('does nothing when JWT is invalid', async () => {
      mockJwt.verify.mockImplementation(() => { throw new Error('invalid'); });
      await service.logout('garbage');
      expect(mockPrisma.refreshToken.findMany).not.toHaveBeenCalled();
    });
  });
});
