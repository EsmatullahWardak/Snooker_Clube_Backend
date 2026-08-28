import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { RoleName } from '../generated/prisma/client';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { PaymentsService } from './payments.service';

@Roles(RoleName.ADMIN, RoleName.MANAGER)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(@Query() query: PaymentQueryDto) {
    return this.payments.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.payments.get(id);
  }
}
