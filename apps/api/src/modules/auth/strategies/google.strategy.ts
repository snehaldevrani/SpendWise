import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(
    config: ConfigService,
    private authService: AuthService,
  ) {
    const clientID = config.get<string>('GOOGLE_CLIENT_ID', '');
    const clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET', '');
    if (!clientID || !clientSecret) {
      new Logger('GoogleStrategy').warn(
        'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set — Google OAuth will not work',
      );
    }
    super({
      clientID,
      clientSecret,
      callbackURL: config.get<string>('GOOGLE_CALLBACK_URL', 'http://localhost:3001/api/auth/google/callback'),
      scope: ['email', 'profile'],
      state: true,
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error('No email from Google profile'), undefined);

    const user = await this.authService.validateGoogleUser({
      googleId: profile.id,
      email,
      displayName: profile.displayName ?? email.split('@')[0],
    });

    done(null, user);
  }
}
