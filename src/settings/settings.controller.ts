import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { RoleName } from '../generated/prisma/client';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@Roles(RoleName.ADMIN)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get() {
    return this.settings.get();
  }

  @Patch()
  update(
    @Body() dto: UpdateSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settings.update(dto, user.id);
  }
}
