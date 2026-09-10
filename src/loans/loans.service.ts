import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { paginationMeta } from '../common/dto/pagination.dto';
import { LoanStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLoanDto, LoanQueryDto } from './dto/loan.dto';

const loanInclude = {
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  updatedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.LoanInclude;

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: LoanQueryDto) {
    const where: Prisma.LoanWhereInput = {
      status: query.status,
      ...(query.search
        ? {
            OR: [
              { playerName: { contains: query.search, mode: 'insensitive' } },
              { fatherName: { contains: query.search, mode: 'insensitive' } },
              { phoneNumber: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total, pending, paid] = await this.prisma.$transaction([
      this.prisma.loan.findMany({
        where,
        include: loanInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.loan.count({ where }),
      this.prisma.loan.aggregate({
        where: { status: LoanStatus.PENDING },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.loan.aggregate({
        where: { status: LoanStatus.PAID },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);
    return {
      data,
      meta: paginationMeta(query.page, query.pageSize, total),
      summary: {
        pendingCount: pending._count._all,
        pendingAmount: pending._sum.amount ?? new Prisma.Decimal(0),
        paidCount: paid._count._all,
        paidAmount: paid._sum.amount ?? new Prisma.Decimal(0),
      },
    };
  }

  async get(id: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id },
      include: loanInclude,
    });
    if (!loan) throw new NotFoundException('Loan not found.');
    return loan;
  }

  create(dto: CreateLoanDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.create({
        data: {
          playerName: dto.playerName,
          fatherName: dto.fatherName,
          phoneNumber: dto.phoneNumber,
          email: dto.email,
          address: dto.address,
          amount: dto.amount,
          createdById: actorId,
          updatedById: actorId,
        },
        include: loanInclude,
      });
      await this.audit.record(
        {
          actorId,
          action: 'LOAN_CREATED',
          resourceType: 'Loan',
          resourceId: loan.id,
          after: {
            playerName: loan.playerName,
            amount: loan.amount.toString(),
            status: loan.status,
          },
        },
        tx,
      );
      return loan;
    });
  }

  async updateStatus(id: string, status: LoanStatus, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const current = await tx.loan.findUnique({ where: { id } });
        if (!current) throw new NotFoundException('Loan not found.');
        if (current.status === status)
          return tx.loan.findUniqueOrThrow({
            where: { id },
            include: loanInclude,
          });

        const updated = await tx.loan.updateMany({
          where: { id, status: current.status },
          data: { status, updatedById: actorId },
        });
        if (updated.count !== 1)
          throw new ConflictException(
            'The loan status changed before it could be updated.',
          );
        await this.audit.record(
          {
            actorId,
            action: 'LOAN_STATUS_CHANGED',
            resourceType: 'Loan',
            resourceId: id,
            before: { status: current.status },
            after: { status },
          },
          tx,
        );
        return tx.loan.findUniqueOrThrow({
          where: { id },
          include: loanInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
