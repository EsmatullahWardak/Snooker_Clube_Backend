import { BadRequestException, Injectable } from '@nestjs/common';
import {
  databaseDate,
  shiftDateKey,
  zonedDateKey,
  zonedDateRange,
  zonedStartOfDay,
} from '../common/time';
import { LoanStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportQueryDto } from './dto/report-query.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const timeZone = await this.clubTimeZone();
    const todayKey = zonedDateKey(new Date(), timeZone);
    const day = zonedDateRange(todayKey, timeZone);
    const [
      totalMembers,
      activeGames,
      tableCounts,
      todayRevenue,
      todayExpenses,
      recentGames,
      recentPayments,
      recentExpenses,
      todayPendingLoans,
      todayPaidLoans,
      todayLoanRecords,
    ] = await Promise.all([
      this.prisma.member.count({ where: { deletedAt: null } }),
      this.prisma.gameSession.count({
        where: { status: { in: ['IN_PROGRESS', 'PAUSED'] } },
      }),
      this.prisma.snookerTable.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: 'PAID',
          paymentDate: { gte: day.start, lt: day.end },
        },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: {
          expenseDate: {
            gte: databaseDate(todayKey),
            lt: databaseDate(shiftDateKey(todayKey, 1)),
          },
        },
        _sum: { amount: true },
      }),
      this.prisma.gameSession.findMany({
        take: 5,
        orderBy: { startTime: 'desc' },
        include: {
          member: { select: { name: true } },
          table: { select: { number: true } },
        },
      }),
      this.prisma.payment.findMany({
        take: 5,
        orderBy: { paymentDate: 'desc' },
        include: { member: { select: { name: true } } },
      }),
      this.prisma.expense.findMany({
        take: 5,
        orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
        include: { category: true },
      }),
      this.prisma.loan.aggregate({
        where: {
          status: LoanStatus.PENDING,
          createdAt: { gte: day.start, lt: day.end },
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.loan.aggregate({
        where: {
          status: LoanStatus.PAID,
          paidAt: { gte: day.start, lt: day.end },
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.loan.findMany({
        where: {
          OR: [
            {
              status: LoanStatus.PENDING,
              createdAt: { gte: day.start, lt: day.end },
            },
            {
              status: LoanStatus.PAID,
              paidAt: { gte: day.start, lt: day.end },
            },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          playerName: true,
          amount: true,
          status: true,
          paidAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const revenue = todayRevenue._sum.amount ?? new Prisma.Decimal(0);
    const expenses = todayExpenses._sum.amount ?? new Prisma.Decimal(0);
    const tables = Object.fromEntries(
      tableCounts.map((row) => [row.status, row._count._all]),
    );
    return {
      stats: {
        totalMembers,
        activeGames,
        availableTables: tables.AVAILABLE ?? 0,
        tablesInUse: tables.IN_USE ?? 0,
        reservedTables: tables.RESERVED ?? 0,
        maintenanceTables: tables.MAINTENANCE ?? 0,
        todayRevenue: revenue,
        todayExpenses: expenses,
        todayNetProfit: revenue.sub(expenses),
      },
      recentGames,
      recentPayments,
      recentExpenses,
      todayLoans: {
        summary: {
          pendingCount: todayPendingLoans._count._all,
          pendingAmount: todayPendingLoans._sum.amount ?? new Prisma.Decimal(0),
          paidCount: todayPaidLoans._count._all,
          paidAmount: todayPaidLoans._sum.amount ?? new Prisma.Decimal(0),
        },
        records: todayLoanRecords,
      },
    };
  }

  async financialSummary(query: ReportQueryDto) {
    const timeZone = await this.clubTimeZone();
    const now = new Date();
    const todayKey = zonedDateKey(now, timeZone);
    const fromKey = query.from?.slice(0, 10) ?? `${todayKey.slice(0, 7)}-01`;
    const toKey = query.to?.slice(0, 10) ?? todayKey;
    if (fromKey > toKey)
      throw new BadRequestException(
        'The from date must be before the to date.',
      );

    const from = zonedStartOfDay(fromKey, timeZone);
    const toExclusive = zonedStartOfDay(shiftDateKey(toKey, 1), timeZone);
    const expenseFrom = databaseDate(fromKey);
    const expenseTo = databaseDate(shiftDateKey(toKey, 1));
    const [
      revenueAggregate,
      expenseAggregate,
      games,
      members,
      methods,
      categoryGroups,
      completedDuration,
    ] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { status: 'PAID', paymentDate: { gte: from, lt: toExclusive } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.expense.aggregate({
        where: { expenseDate: { gte: expenseFrom, lt: expenseTo } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.gameSession.groupBy({
        by: ['status'],
        where: { startTime: { gte: from, lt: toExclusive } },
        _count: { _all: true },
      }),
      this.prisma.member.count({
        where: { createdAt: { gte: from, lt: toExclusive }, deletedAt: null },
      }),
      this.prisma.payment.groupBy({
        by: ['method'],
        where: { status: 'PAID', paymentDate: { gte: from, lt: toExclusive } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.expense.groupBy({
        by: ['categoryId'],
        where: { expenseDate: { gte: expenseFrom, lt: expenseTo } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.gameSession.aggregate({
        where: {
          status: 'COMPLETED',
          startTime: { gte: from, lt: toExclusive },
        },
        _sum: { durationSeconds: true },
      }),
    ]);

    const categories = await this.prisma.expenseCategory.findMany({
      where: { id: { in: categoryGroups.map((group) => group.categoryId) } },
      select: { id: true, name: true },
    });
    const categoryNames = new Map(
      categories.map((category) => [category.id, category.name]),
    );
    const revenue = revenueAggregate._sum.amount ?? new Prisma.Decimal(0);
    const expenses = expenseAggregate._sum.amount ?? new Prisma.Decimal(0);

    return {
      period: { from: fromKey, to: toKey, timeZone },
      revenue: { amount: revenue, payments: revenueAggregate._count._all },
      expenses: { amount: expenses, records: expenseAggregate._count._all },
      netProfit: revenue.sub(expenses),
      games: Object.fromEntries(
        games.map((row) => [row.status, row._count._all]),
      ),
      newMembers: members,
      tableHours:
        Math.round(
          ((completedDuration._sum.durationSeconds ?? 0) / 3600) * 100,
        ) / 100,
      paymentMethods: methods,
      expenseCategories: categoryGroups.map((group) => ({
        categoryId: group.categoryId,
        categoryName: categoryNames.get(group.categoryId) ?? 'Unknown',
        amount: group._sum.amount ?? new Prisma.Decimal(0),
        count: group._count._all,
      })),
    };
  }

  private async clubTimeZone() {
    const settings = await this.prisma.clubSetting.findUniqueOrThrow({
      where: { id: 'default' },
      select: { timezone: true },
    });
    return settings.timezone;
  }
}
