import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { RoleName } from '../generated/prisma/client';
import { UpdateTableStatusDto } from './dto/update-table-status.dto';
import { TablesService } from './tables.service';

@Controller('tables')
export class TablesController {
  constructor(private readonly tables: TablesService) {}

  @Get()
  list() {
    return this.tables.list();
  }

  @Roles(RoleName.ADMIN, RoleName.MANAGER)
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTableStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tables.updateStatus(id, dto.status, user);
  }
}
