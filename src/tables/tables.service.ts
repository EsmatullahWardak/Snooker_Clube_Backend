import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { calculateBilling } from '../common/billing';
import { Prisma, RoleName, TableStatus } from '../generated/prisma/client';
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
          where: { status: { in: ['IN_PROGRESS', 'PAUSED'] } },
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
        game.pausedAt ?? new Date(),
        game.hourlyRateSnapshot,
        game.totalPausedSeconds,
      );
      return {
        ...table,
        gameSessions: undefined,
        activeGame: {
          ...game,
          currentDurationSeconds: estimate.durationSeconds,
          currentAmount: estimate.baseAmount,
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

    return this.prisma.$transaction(
      async (tx) => {
        const table = await tx.snookerTable.findUnique({ where: { id } });
        if (!table) throw new NotFoundException('Table not found.');
        if (table.status === TableStatus.IN_USE)
          throw new ConflictException(
            'End the active game before changing table state.',
          );

        const changed = await tx.snookerTable.updateMany({
          where: { id, status: table.status },
          data: { status },
        });
        if (changed.count !== 1)
          throw new ConflictException(
            'The table state changed before it could be updated.',
          );
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
        return tx.snookerTable.findUniqueOrThrow({ where: { id } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
