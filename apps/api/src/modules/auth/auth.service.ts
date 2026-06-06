import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthTokens, JwtPayload } from '@spendwise/shared-types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { AlertsService } from '../alerts/alerts.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private alerts: AlertsService,
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
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');

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
    let matchedExpiresAt: Date | null = null;
    for (const candidate of candidates) {
      if (await bcrypt.compare(token, candidate.tokenHash)) {
        matchedId = candidate.id;
        matchedExpiresAt = candidate.expiresAt;
        break;
      }
    }

    if (!matchedId || !matchedExpiresAt) throw new UnauthorizedException('Refresh token invalid or expired');

    // Atomic consume — delete the matched row
    await this.prisma.refreshToken.delete({ where: { id: matchedId } });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    // Pass the original expiry so rotation does not extend the session clock
    return this.issueTokens(user.id, user.email, matchedExpiresAt);
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

  // ─── Password Reset ────────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    // Always return silently — never reveal whether an email is registered
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;

    // Invalidate any prior unused tokens for this user
    await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    await this.alerts.sendAlert(
      email,
      'SpendWise — Reset your password',
      `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
        <h2 style="color:#10b981;">SpendWise Password Reset</h2>
        <p>Someone requested a password reset for your SpendWise account (<strong>${email}</strong>).</p>
        <p>If this was you, click the link below to set a new password. The link expires in <strong>1 hour</strong>.</p>
        <p style="margin:24px 0;">
          <a href="${resetUrl}" style="background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
            Reset my password
          </a>
        </p>
        <p>If you didn't request this, you can safely ignore this email. Your password has not changed.</p>
        <p style="color:#71717a;font-size:12px;margin-top:32px;">SpendWise · Your data, your control.</p>
      </div>`,
    );
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const candidates = await this.prisma.passwordResetToken.findMany({
      where: { usedAt: null, expiresAt: { gt: new Date() } },
    });

    let matched: { id: string; userId: string } | null = null;
    for (const c of candidates) {
      if (await bcrypt.compare(rawToken, c.tokenHash)) {
        matched = { id: c.id, userId: c.userId };
        break;
      }
    }

    if (!matched) throw new BadRequestException('Invalid or expired reset token');

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({ where: { id: matched.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: matched.userId }, data: { passwordHash } }),
      this.prisma.refreshToken.deleteMany({ where: { userId: matched.userId } }),
    ]);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) throw new BadRequestException('No password set on this account');

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  // ─── Google OAuth ──────────────────────────────────────────────────────────

  async validateGoogleUser(profile: { googleId: string; email: string; displayName: string }): Promise<{ id: string; email: string }> {
    let user = await this.prisma.user.findUnique({ where: { googleId: profile.googleId } });
    if (user) return { id: user.id, email: user.email };

    user = await this.prisma.user.findUnique({ where: { email: profile.email } });
    if (user) {
      await this.prisma.user.update({ where: { id: user.id }, data: { googleId: profile.googleId } });
      return { id: user.id, email: user.email };
    }

    user = await this.prisma.user.create({
      data: { email: profile.email, googleId: profile.googleId },
    });
    return { id: user.id, email: user.email };
  }

  async issueTokensForOAuth(userId: string, email: string): Promise<AuthTokens> {
    return this.issueTokens(userId, email);
  }

  private async issueTokens(userId: string, email: string, existingExpiresAt?: Date): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, email };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRES_IN'),
    });

    // On fresh login/signup: create a new 24-hour session window.
    // On rotation: reuse the original expiry so the session clock is never reset.
    const refreshExpiresAt = existingExpiresAt ?? (() => {
      const d = new Date();
      d.setHours(d.getHours() + 24);
      return d;
    })();

    // Sign the refresh JWT to expire at the same instant as the DB record,
    // so neither layer can be used after the session window closes.
    const remainingSecs = Math.max(1, Math.floor((refreshExpiresAt.getTime() - Date.now()) / 1000));

    // Refresh token is a signed JWT (allows userId extraction without a DB lookup),
    // but we only store a bcrypt hash — a DB breach cannot be used to hijack sessions.
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: remainingSecs,
    });
    const tokenHash = await bcrypt.hash(refreshToken, 10);

    await this.prisma.refreshToken.create({
      data: { tokenHash, userId, expiresAt: refreshExpiresAt },
    });

    return { accessToken, refreshToken, refreshExpiresAt };
  }
}
