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
  CreateExpenseDto,
  ExpenseQueryDto,
  UpdateExpenseDto,
} from './dto/expense.dto';
import { ExpensesService } from './expenses.service';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get('categories')
  categories() {
    return this.expenses.categories();
  }

  @Get('overview')
  overview() {
    return this.expenses.overview();
  }

  @Get()
  list(@Query() query: ExpenseQueryDto) {
    return this.expenses.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.expenses.get(id);
  }

  @Post()
  create(
    @Body() dto: CreateExpenseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expenses.create(dto, user.id);
  }

  @Roles(RoleName.ADMIN, RoleName.MANAGER)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expenses.update(id, dto, user.id);
  }
}
