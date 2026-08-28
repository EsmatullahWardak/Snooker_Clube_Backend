import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { token, user } = await this.auth.login(dto);
    response.cookie('snooker_session', token, this.cookieOptions());
    return { user };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.recordLogout(user.id);
    response.clearCookie('snooker_session', this.cookieOptions());
    return { message: 'Logged out successfully.' };
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict' as const,
      path: '/',
    };
  }
}
