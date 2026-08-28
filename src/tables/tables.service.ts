import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { calculateBilling } from '../common/billing';
import { RoleName, TableStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const tables = await this.prisma.snookerTable.findMany({
      include: {
        gameSessions: {
          where: { status: 'IN_PROGRESS' },
          take: 1,
          orderBy: { startTime: 'desc' },
          include: {
            member: { include: { membershipType: true } },
            createdBy: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { number: 'asc' },
    });

    return tables.map((table) => {
      const game = table.gameSessions[0];
      if (!game) return { ...table, gameSessions: undefined, activeGame: null };
      const estimate = calculateBilling(
        game.startTime,
        new Date(),
        game.hourlyRateSnapshot,
        game.discountPercentSnapshot,
      );
      return {
        ...table,
        gameSessions: undefined,
        activeGame: {
          ...game,
          currentDurationSeconds: estimate.durationSeconds,
          currentAmount: estimate.finalAmount,
        },
      };
    });
  }

  async updateStatus(
    id: string,
    status: TableStatus,
    actor: { id: string; role: RoleName },
  ) {
    if (status === TableStatus.IN_USE) {
      throw new BadRequestException(
        'A table becomes in use only when a game starts.',
      );
    }
    if (status === TableStatus.RESERVED) {
      throw new BadRequestException(
        'Reservations are unavailable until the Bookings module is enabled.',
      );
    }

    const table = await this.prisma.snookerTable.findUnique({ where: { id } });
    if (!table) throw new NotFoundException('Table not found.');
    if (table.status === TableStatus.IN_USE)
      throw new ConflictException(
        'End the active game before changing table state.',
      );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.snookerTable.update({
        where: { id },
        data: { status },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'TABLE_STATUS_CHANGED',
          resourceType: 'SnookerTable',
          resourceId: id,
          before: { status: table.status },
          after: { status },
        },
        tx,
      );
      return updated;
    });
  }
}
