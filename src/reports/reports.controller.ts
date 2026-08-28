import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { RoleName } from '../generated/prisma/client';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard')
  dashboard() {
    return this.reports.dashboard();
  }

  @Roles(RoleName.ADMIN, RoleName.MANAGER)
  @Get('financial-summary')
  financial(@Query() query: ReportQueryDto) {
    return this.reports.financialSummary(query);
  }
}
