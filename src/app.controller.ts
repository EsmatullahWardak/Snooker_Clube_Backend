import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get()
  health() {
    return {
      status: 'ok',
      service: 'snooker-club-api',
      timestamp: new Date().toISOString(),
    };
  }
}
