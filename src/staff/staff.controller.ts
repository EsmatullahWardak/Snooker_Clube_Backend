import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { RoleName } from '../generated/prisma/client';
import { CreateStaffDto, StaffQueryDto, UpdateStaffDto } from './dto/staff.dto';
import { StaffService } from './staff.service';

@Roles(RoleName.ADMIN)
@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list(@Query() query: StaffQueryDto) {
    return this.staff.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.staff.get(id);
  }

  @Post()
  create(@Body() dto: CreateStaffDto, @CurrentUser() user: AuthenticatedUser) {
    return this.staff.create(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staff.update(id, dto, user.id);
  }
}
