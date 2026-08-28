import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportQueryDto } from './dto/report-query.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const day = this.kabulDay();
    const [
      totalMembers,
      activeGames,
      tableCounts,
      todayRevenue,
      todayExpenses,
      recentGames,
      recentPayments,
      recentExpenses,
    ] = await Promise.all([
      this.prisma.member.count({ where: { deletedAt: null } }),
      this.prisma.gameSession.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.snookerTable.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: 'PAID',
          paymentDate: { gte: day.instantStart, lt: day.instantEnd },
        },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: { expenseDate: { gte: day.dateStart, lt: day.dateEnd } },
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
    };
  }

  async financialSummary(query: ReportQueryDto) {
    const now = new Date();
    const defaultFrom = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const from = query.from ? new Date(query.from) : defaultFrom;
    const to = query.to ? new Date(query.to) : now;
    if (from > to)
      throw new BadRequestException(
        'The from date must be before the to date.',
      );

    const paymentTo = new Date(to);
    paymentTo.setUTCHours(23, 59, 59, 999);
    const expenseTo = new Date(
      Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() + 1),
    );
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
        where: { status: 'PAID', paymentDate: { gte: from, lte: paymentTo } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.expense.aggregate({
        where: { expenseDate: { gte: from, lt: expenseTo } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.gameSession.groupBy({
        by: ['status'],
        where: { startTime: { gte: from, lte: paymentTo } },
        _count: { _all: true },
      }),
      this.prisma.member.count({
        where: { createdAt: { gte: from, lte: paymentTo }, deletedAt: null },
      }),
      this.prisma.payment.groupBy({
        by: ['method'],
        where: { status: 'PAID', paymentDate: { gte: from, lte: paymentTo } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.expense.groupBy({
        by: ['categoryId'],
        where: { expenseDate: { gte: from, lt: expenseTo } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.gameSession.aggregate({
        where: {
          status: 'COMPLETED',
          startTime: { gte: from, lte: paymentTo },
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
      period: { from, to },
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

  private kabulDay() {
    const offsetMilliseconds = 4.5 * 60 * 60 * 1000;
    const shifted = new Date(Date.now() + offsetMilliseconds);
    const date = shifted.toISOString().slice(0, 10);
    const nextDate = new Date(`${date}T00:00:00.000Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    return {
      instantStart: new Date(`${date}T00:00:00+04:30`),
      instantEnd: new Date(nextDate.getTime() - offsetMilliseconds),
      dateStart: new Date(`${date}T00:00:00.000Z`),
      dateEnd: nextDate,
    };
  }
}
