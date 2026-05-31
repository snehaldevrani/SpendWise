import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthTokens, JwtPayload } from '@spendwise/shared-types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthTokens> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash },
    });

    return this.issueTokens(user.id, user.email);
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user.id, user.email);
  }

  async refresh(token: string): Promise<AuthTokens> {
    // Load all non-expired refresh tokens for the userId encoded in the JWT
    // then bcrypt.compare each until we find a match — avoids storing raw tokens
    let userId: string;
    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    const candidates = await this.prisma.refreshToken.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
    });

    let matchedId: string | null = null;
    for (const candidate of candidates) {
      if (await bcrypt.compare(token, candidate.tokenHash)) {
        matchedId = candidate.id;
        break;
      }
    }

    if (!matchedId) throw new UnauthorizedException('Refresh token invalid or expired');

    // Atomic consume — delete the matched row
    await this.prisma.refreshToken.delete({ where: { id: matchedId } });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    return this.issueTokens(user.id, user.email);
  }

  async logout(token: string): Promise<void> {
    // Decode userId from token (don't throw if token is already invalid)
    let userId: string | null = null;
    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
      userId = payload.sub;
    } catch {
      return; // Nothing to revoke
    }

    if (!userId) return;

    // Find all candidates and compare; delete the matching one
    const candidates = await this.prisma.refreshToken.findMany({
      where: { userId },
    });

    for (const candidate of candidates) {
      if (await bcrypt.compare(token, candidate.tokenHash)) {
        await this.prisma.refreshToken.delete({ where: { id: candidate.id } });
        break;
      }
    }
  }

  private async issueTokens(userId: string, email: string): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, email };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRES_IN'),
    });

    // Refresh token is a signed JWT (allows userId extraction without a DB lookup),
    // but we only store a bcrypt hash — a DB breach cannot be used to hijack sessions.
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN'),
    });
    const tokenHash = await bcrypt.hash(refreshToken, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: { tokenHash, userId, expiresAt },
    });

    return { accessToken, refreshToken };
  }
}
