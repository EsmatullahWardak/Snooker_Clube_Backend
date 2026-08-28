import { Injectable, NotFoundException } from '@nestjs/common';
import { paginationMeta } from '../common/dto/pagination.dto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentQueryDto } from './dto/payment-query.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PaymentQueryDto) {
    const where: Prisma.PaymentWhereInput = {
      method: query.method,
      status: query.status,
      memberId: query.memberId,
      ...(query.from || query.to
        ? {
            paymentDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: {
          member: { select: { id: true, name: true, membershipNumber: true } },
          game: { include: { table: { select: { number: true } } } },
          receivedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { paymentDate: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { data, meta: paginationMeta(query.page, query.pageSize, total) };
  }

  async get(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        member: { include: { membershipType: true } },
        game: { include: { table: true } },
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found.');
    return payment;
  }
}
