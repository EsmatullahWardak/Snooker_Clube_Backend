import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';

interface JwtPayload {
  sub: string;
}

const cookieExtractor = (request: Request): string | null =>
  (request.cookies as Record<string, string> | undefined)?.snooker_session ??
  null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly auth: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.auth.findAuthenticatedUser(payload.sub);
    if (!user) throw new UnauthorizedException('Session is no longer valid.');
    return user;
  }
}
