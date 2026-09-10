import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import {
  calculateBilling,
  calculateSettlement,
  type SettlementResult,
} from '../common/billing';
import { paginationMeta } from '../common/dto/pagination.dto';
import { shiftDateKey, zonedStartOfDay } from '../common/time';
import { GameStatus, Prisma, TableStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EndGameDto, GameQueryDto, StartGameDto } from './dto/game.dto';

const gameInclude = {
  table: true,
  member: { include: { membershipType: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  endedBy: { select: { id: true, firstName: true, lastName: true } },
  payment: true,
} satisfies Prisma.GameSessionInclude;

const activeGameStatuses: GameStatus[] = [
  GameStatus.IN_PROGRESS,
  GameStatus.PAUSED,
];

@Injectable()
export class GamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: GameQueryDto) {
    const settings = await this.prisma.clubSetting.findUniqueOrThrow({
      where: { id: 'default' },
      select: { timezone: true },
    });
    const where: Prisma.GameSessionWhereInput = {
      ...(query.activeOnly
        ? { status: { in: activeGameStatuses } }
        : query.status
          ? { status: query.status }
          : {}),
      ...(query.memberId ? { memberId: query.memberId } : {}),
      ...(query.tableNumber ? { table: { number: query.tableNumber } } : {}),
      ...(query.from || query.to
        ? {
            startTime: {
              ...(query.from
                ? {
                    gte: zonedStartOfDay(
                      query.from.slice(0, 10),
                      settings.timezone,
                    ),
                  }
                : {}),
              ...(query.to
                ? {
                    lt: zonedStartOfDay(
                      shiftDateKey(query.to.slice(0, 10), 1),
                      settings.timezone,
                    ),
                  }
                : {}),
            },
          }
        : {}),
    };
    const [games, total, summary] = await this.prisma.$transaction([
      this.prisma.gameSession.findMany({
        where,
        include: gameInclude,
        orderBy: { startTime: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.gameSession.count({ where }),
      this.prisma.gameSession.aggregate({
        where,
        _sum: {
          durationSeconds: true,
          discountAmount: true,
          finalAmount: true,
        },
        _avg: { durationSeconds: true },
      }),
    ]);
    return {
      data: games.map((game) => this.withLiveEstimate(game)),
      meta: paginationMeta(query.page, query.pageSize, total),
      summary: {
        totalGames: total,
        totalDurationSeconds: summary._sum.durationSeconds ?? 0,
        totalDiscount: summary._sum.discountAmount ?? new Prisma.Decimal(0),
        totalRevenue: summary._sum.finalAmount ?? new Prisma.Decimal(0),
        averageDurationSeconds: Math.round(summary._avg.durationSeconds ?? 0),
      },
    };
  }

  async get(id: string) {
    const game = await this.prisma.gameSession.findUnique({
      where: { id },
      include: gameInclude,
    });
    if (!game) throw new NotFoundException('Game not found.');
    return this.withLiveEstimate(game);
  }

  async start(dto: StartGameDto, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const [table, member, settings] = await Promise.all([
          tx.snookerTable.findUnique({ where: { id: dto.tableId } }),
          dto.memberId
            ? tx.member.findFirst({
                where: { id: dto.memberId, status: 'ACTIVE', deletedAt: null },
                include: { membershipType: true },
              })
            : Promise.resolve(null),
          tx.clubSetting.findUnique({ where: { id: 'default' } }),
        ]);
        if (!table) throw new NotFoundException('Table not found.');
        if (dto.memberId && !member)
          throw new NotFoundException('Active member not found.');
        if (!settings)
          throw new ConflictException('Club billing settings are missing.');
        if (table.status !== TableStatus.AVAILABLE)
          throw new ConflictException('Table is not available.');

        const claimed = await tx.snookerTable.updateMany({
          where: { id: table.id, status: TableStatus.AVAILABLE },
          data: { status: TableStatus.IN_USE },
        });
        if (claimed.count !== 1)
          throw new ConflictException('Table was claimed by another game.');

        const game = await tx.gameSession.create({
          data: {
            code: `GAME-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`,
            tableId: table.id,
            memberId: member?.id,
            startTime: new Date(),
            hourlyRateSnapshot:
              table.hourlyRateOverride ?? settings.defaultHourlyRate,
            membershipCodeSnapshot: member?.membershipType.code,
            createdById: actorId,
          },
          include: gameInclude,
        });
        await this.audit.record(
          {
            actorId,
            action: 'GAME_STARTED',
            resourceType: 'GameSession',
            resourceId: game.id,
            after: {
              tableNumber: table.number,
              memberId: member?.id ?? null,
              sessionType: member ? 'MEMBER' : 'WALK_IN',
            },
          },
          tx,
        );
        return game;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async end(id: string, dto: EndGameDto, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const game = await tx.gameSession.findUnique({ where: { id } });
        if (!game) throw new NotFoundException('Game not found.');
        if (!activeGameStatuses.includes(game.status))
          throw new ConflictException('Only an active game can be ended.');

        const endTime = new Date();
        const finalPausedSeconds =
          game.totalPausedSeconds +
          (game.pausedAt
            ? Math.max(
                0,
                Math.floor(
                  (endTime.getTime() - game.pausedAt.getTime()) / 1000,
                ),
              )
            : 0);
        const bill = calculateBilling(
          game.startTime,
          game.pausedAt ?? endTime,
          game.hourlyRateSnapshot,
          game.totalPausedSeconds,
        );
        let settlement: SettlementResult;
        try {
          settlement = calculateSettlement(
            bill.baseAmount,
            new Prisma.Decimal(dto.discountAmount),
            dto.adjustedTotalAmount === undefined
              ? undefined
              : new Prisma.Decimal(dto.adjustedTotalAmount),
          );
        } catch (error) {
          if (error instanceof RangeError)
            throw new BadRequestException(error.message);
          throw error;
        }
        const completed = await tx.gameSession.updateMany({
          where: { id, status: game.status },
          data: {
            status: GameStatus.COMPLETED,
            endTime,
            pausedAt: null,
            totalPausedSeconds: finalPausedSeconds,
            durationSeconds: bill.durationSeconds,
            baseAmount: bill.baseAmount,
            discountAmount: settlement.discountAmount,
            manualAdjustmentAmount: settlement.manualAdjustmentAmount,
            finalAmount: settlement.finalAmount,
            paymentStatus: 'PAID',
            endedById: actorId,
          },
        });
        if (completed.count !== 1)
          throw new ConflictException(
            'Game was already ended by another request.',
          );

        const payment = await tx.payment.create({
          data: {
            receiptNumber: `RCP-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`,
            gameId: game.id,
            memberId: game.memberId,
            amount: settlement.finalAmount,
            method: dto.paymentMethod,
            status: 'PAID',
            receivedById: actorId,
            reference: dto.reference,
            notes: dto.notes,
          },
        });
        await tx.snookerTable.update({
          where: { id: game.tableId },
          data: { status: TableStatus.AVAILABLE },
        });
        await this.audit.record(
          {
            actorId,
            action: 'GAME_ENDED',
            resourceType: 'GameSession',
            resourceId: game.id,
            after: {
              durationSeconds: bill.durationSeconds,
              baseAmount: bill.baseAmount.toString(),
              discountAmount: settlement.discountAmount.toString(),
              manualAdjustmentAmount:
                settlement.manualAdjustmentAmount.toString(),
              finalAmount: settlement.finalAmount.toString(),
              receiptNumber: payment.receiptNumber,
            },
          },
          tx,
        );
        const completedGame = await tx.gameSession.findUniqueOrThrow({
          where: { id },
          include: gameInclude,
        });
        return this.withLiveEstimate(completedGame);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async pause(id: string, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const game = await tx.gameSession.findUnique({ where: { id } });
        if (!game) throw new NotFoundException('Game not found.');
        if (game.status !== GameStatus.IN_PROGRESS)
          throw new ConflictException('Only a running game can be paused.');
        const pausedAt = new Date();
        const updated = await tx.gameSession.updateMany({
          where: { id, status: GameStatus.IN_PROGRESS },
          data: { status: GameStatus.PAUSED, pausedAt },
        });
        if (updated.count !== 1)
          throw new ConflictException('The game state changed. Please retry.');
        await this.audit.record(
          {
            actorId,
            action: 'GAME_PAUSED',
            resourceType: 'GameSession',
            resourceId: id,
            after: { pausedAt: pausedAt.toISOString() },
          },
          tx,
        );
        const paused = await tx.gameSession.findUniqueOrThrow({
          where: { id },
          include: gameInclude,
        });
        return this.withLiveEstimate(paused);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async resume(id: string, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const game = await tx.gameSession.findUnique({ where: { id } });
        if (!game) throw new NotFoundException('Game not found.');
        if (game.status !== GameStatus.PAUSED || !game.pausedAt)
          throw new ConflictException('Only a paused game can be resumed.');
        const resumedAt = new Date();
        const pausedSeconds = Math.max(
          0,
          Math.floor((resumedAt.getTime() - game.pausedAt.getTime()) / 1000),
        );
        const updated = await tx.gameSession.updateMany({
          where: { id, status: GameStatus.PAUSED },
          data: {
            status: GameStatus.IN_PROGRESS,
            pausedAt: null,
            totalPausedSeconds: { increment: pausedSeconds },
          },
        });
        if (updated.count !== 1)
          throw new ConflictException('The game state changed. Please retry.');
        await this.audit.record(
          {
            actorId,
            action: 'GAME_RESUMED',
            resourceType: 'GameSession',
            resourceId: id,
            after: { resumedAt: resumedAt.toISOString(), pausedSeconds },
          },
          tx,
        );
        const resumed = await tx.gameSession.findUniqueOrThrow({
          where: { id },
          include: gameInclude,
        });
        return this.withLiveEstimate(resumed);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async cancel(id: string, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const game = await tx.gameSession.findUnique({ where: { id } });
        if (!game) throw new NotFoundException('Game not found.');
        if (!activeGameStatuses.includes(game.status))
          throw new ConflictException('Only an active game can be cancelled.');
        const cancelled = await tx.gameSession.updateMany({
          where: { id, status: game.status },
          data: {
            status: 'CANCELLED',
            endTime: new Date(),
            endedById: actorId,
          },
        });
        if (cancelled.count !== 1)
          throw new ConflictException(
            'The game state changed before it could be cancelled.',
          );
        await tx.snookerTable.update({
          where: { id: game.tableId },
          data: { status: 'AVAILABLE' },
        });
        await this.audit.record(
          {
            actorId,
            action: 'GAME_CANCELLED',
            resourceType: 'GameSession',
            resourceId: id,
          },
          tx,
        );
        return tx.gameSession.findUniqueOrThrow({
          where: { id },
          include: gameInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private withLiveEstimate<
    T extends {
      status: GameStatus;
      startTime: Date;
      pausedAt: Date | null;
      totalPausedSeconds: number;
      hourlyRateSnapshot: Prisma.Decimal;
    },
  >(game: T) {
    if (!activeGameStatuses.includes(game.status))
      return { ...game, liveEstimate: null };
    const bill = calculateBilling(
      game.startTime,
      game.pausedAt ?? new Date(),
      game.hourlyRateSnapshot,
      game.totalPausedSeconds,
    );
    return {
      ...game,
      liveEstimate: {
        durationSeconds: bill.durationSeconds,
        currentAmount: bill.baseAmount,
      },
    };
  }
}
