import { Controller, HttpCode, HttpStatus, Post, Body, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthTokens } from '@spendwise/shared-types';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';

// Strict limit for auth endpoints: 5 requests per 15 minutes
const AUTH_THROTTLE = { default: { limit: 5, ttl: 900_000 } };

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;        // 15 minutes
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('signup')
  @HttpCode(HttpStatus.OK)
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.signup(dto);
    this.setAuthCookies(res, tokens);
    return {};
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.login(dto);
    this.setAuthCookies(res, tokens);
    return {};
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token as string | undefined;
    if (!refreshToken) throw new UnauthorizedException('No refresh token');
    const tokens = await this.authService.refresh(refreshToken);
    this.setAuthCookies(res, tokens);
    return {};
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token as string | undefined;
    if (refreshToken) await this.authService.logout(refreshToken);
    const isProd = process.env.NODE_ENV === 'production';
    const clearOpts = { path: '/', secure: isProd, sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax' };
    res.clearCookie('access_token', clearOpts);
    res.clearCookie('refresh_token', clearOpts);
  }

  private setAuthCookies(res: Response, tokens: AuthTokens): void {
    const isProd = process.env.NODE_ENV === 'production';
    const base = { httpOnly: true, secure: isProd, sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax', path: '/' };
    res.cookie('access_token', tokens.accessToken, { ...base, maxAge: ACCESS_TOKEN_TTL_MS });
    res.cookie('refresh_token', tokens.refreshToken, { ...base, maxAge: REFRESH_TOKEN_TTL_MS });
  }
}
