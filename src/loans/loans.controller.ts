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
import {
  CreateLoanDto,
  LoanQueryDto,
  UpdateLoanStatusDto,
} from './dto/loan.dto';
import { LoansService } from './loans.service';

@Controller('loans')
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Get()
  list(@Query() query: LoanQueryDto) {
    return this.loans.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.loans.get(id);
  }

  @Post()
  create(@Body() dto: CreateLoanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.loans.create(dto, user.id);
  }

  @Roles(RoleName.ADMIN, RoleName.MANAGER)
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLoanStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.loans.updateStatus(id, dto.status, user.id);
  }
}
