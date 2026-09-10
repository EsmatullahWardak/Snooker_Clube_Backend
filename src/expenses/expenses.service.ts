import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { paginationMeta } from '../common/dto/pagination.dto';
import { databaseDate, shiftDateKey, zonedDateKey } from '../common/time';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateExpenseDto,
  ExpenseQueryDto,
  UpdateExpenseDto,
} from './dto/expense.dto';

const expenseInclude = {
  category: true,
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  updatedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.ExpenseInclude;

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  categories() {
    return this.prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async overview() {
    const settings = await this.prisma.clubSetting.findUniqueOrThrow({
      where: { id: 'default' },
      select: { timezone: true },
    });
    const todayKey = zonedDateKey(new Date(), settings.timezone);
    const today = databaseDate(todayKey);
    const tomorrow = databaseDate(shiftDateKey(todayKey, 1));
    const week = databaseDate(
      shiftDateKey(todayKey, -((today.getUTCDay() + 6) % 7)),
    );
    const month = databaseDate(`${todayKey.slice(0, 7)}-01`);
    const year = databaseDate(`${todayKey.slice(0, 4)}-01-01`);
    const aggregateFor = (from: Date) =>
      this.prisma.expense.aggregate({
        where: { expenseDate: { gte: from, lt: tomorrow } },
        _sum: { amount: true },
        _count: { _all: true },
      });
    const [
      todayData,
      weekData,
      monthData,
      yearData,
      categoryGroups,
      dailyGroups,
    ] = await Promise.all([
      aggregateFor(today),
      aggregateFor(week),
      aggregateFor(month),
      aggregateFor(year),
      this.prisma.expense.groupBy({
        by: ['categoryId'],
        where: { expenseDate: { gte: month, lt: tomorrow } },
        _sum: { amount: true },
        _count: { _all: true },
        orderBy: { categoryId: 'asc' },
      }),
      this.prisma.expense.groupBy({
        by: ['expenseDate'],
        where: { expenseDate: { gte: month, lt: tomorrow } },
        _sum: { amount: true },
        orderBy: { expenseDate: 'asc' },
      }),
    ]);
    const categories = await this.prisma.expenseCategory.findMany({
      where: { id: { in: categoryGroups.map((group) => group.categoryId) } },
      select: { id: true, name: true },
    });
    const names = new Map(
      categories.map((category) => [category.id, category.name]),
    );
    const period = (data: typeof todayData) => ({
      amount: data._sum.amount ?? new Prisma.Decimal(0),
      count: data._count._all,
    });
    return {
      today: period(todayData),
      week: period(weekData),
      month: period(monthData),
      year: period(yearData),
      categories: categoryGroups.map((group) => ({
        id: group.categoryId,
        name: names.get(group.categoryId) ?? 'Unknown',
        amount: group._sum.amount ?? new Prisma.Decimal(0),
        count: group._count._all,
      })),
      daily: dailyGroups.map((group) => ({
        date: group.expenseDate,
        amount: group._sum.amount ?? new Prisma.Decimal(0),
      })),
    };
  }

  async list(query: ExpenseQueryDto) {
    const where: Prisma.ExpenseWhereInput = {
      categoryId: query.categoryId,
      paymentMethod: query.paymentMethod,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { vendor: { contains: query.search, mode: 'insensitive' } },
              { reference: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.from || query.to
        ? {
            expenseDate: {
              ...(query.from
                ? { gte: databaseDate(query.from.slice(0, 10)) }
                : {}),
              ...(query.to
                ? {
                    lt: databaseDate(shiftDateKey(query.to.slice(0, 10), 1)),
                  }
                : {}),
            },
          }
        : {}),
    };
    const [data, total, aggregate] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        include: expenseInclude,
        orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.expense.count({ where }),
      this.prisma.expense.aggregate({ where, _sum: { amount: true } }),
    ]);
    return {
      data,
      summary: { totalAmount: aggregate._sum.amount ?? new Prisma.Decimal(0) },
      meta: paginationMeta(query.page, query.pageSize, total),
    };
  }

  async get(id: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: expenseInclude,
    });
    if (!expense) throw new NotFoundException('Expense not found.');
    return expense;
  }

  async create(dto: CreateExpenseDto, actorId: string) {
    await this.assertCategory(dto.categoryId);
    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          title: dto.title,
          categoryId: dto.categoryId,
          amount: dto.amount,
          expenseDate: new Date(dto.expenseDate),
          paymentMethod: dto.paymentMethod,
          vendor: dto.vendor,
          description: dto.description,
          receiptUrl: dto.receiptUrl,
          reference: dto.reference,
          isRecurring: dto.isRecurring ?? false,
          createdById: actorId,
          updatedById: actorId,
        },
        include: expenseInclude,
      });
      await this.audit.record(
        {
          actorId,
          action: 'EXPENSE_CREATED',
          resourceType: 'Expense',
          resourceId: expense.id,
          after: { title: expense.title, amount: expense.amount.toString() },
        },
        tx,
      );
      return expense;
    });
  }

  async update(id: string, dto: UpdateExpenseDto, actorId: string) {
    const current = await this.prisma.expense.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Expense not found.');
    if (dto.categoryId) await this.assertCategory(dto.categoryId);

    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.update({
        where: { id },
        data: {
          title: dto.title,
          categoryId: dto.categoryId,
          amount: dto.amount,
          expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
          paymentMethod: dto.paymentMethod,
          vendor: dto.vendor,
          description: dto.description,
          receiptUrl: dto.receiptUrl,
          reference: dto.reference,
          isRecurring: dto.isRecurring,
          updatedById: actorId,
        },
        include: expenseInclude,
      });
      await this.audit.record(
        {
          actorId,
          action: 'EXPENSE_UPDATED',
          resourceType: 'Expense',
          resourceId: id,
          before: { title: current.title, amount: current.amount.toString() },
          after: { title: expense.title, amount: expense.amount.toString() },
        },
        tx,
      );
      return expense;
    });
  }

  private async assertCategory(categoryId: string) {
    const category = await this.prisma.expenseCategory.findFirst({
      where: { id: categoryId, isActive: true },
    });
    if (!category) throw new NotFoundException('Expense category not found.');
  }
}
