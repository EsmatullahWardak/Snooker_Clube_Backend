import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { calculateBilling } from '../common/billing';
import { paginationMeta } from '../common/dto/pagination.dto';
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

@Injectable()
export class GamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: GameQueryDto) {
    const where: Prisma.GameSessionWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.memberId ? { memberId: query.memberId } : {}),
      ...(query.tableNumber ? { table: { number: query.tableNumber } } : {}),
      ...(query.from || query.to
        ? {
            startTime: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
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
          tx.member.findFirst({
            where: { id: dto.memberId, status: 'ACTIVE', deletedAt: null },
            include: { membershipType: true },
          }),
          tx.clubSetting.findUnique({ where: { id: 'default' } }),
        ]);
        if (!table) throw new NotFoundException('Table not found.');
        if (!member) throw new NotFoundException('Active member not found.');
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
            memberId: member.id,
            startTime: new Date(),
            hourlyRateSnapshot:
              table.hourlyRateOverride ?? settings.defaultHourlyRate,
            membershipCodeSnapshot: member.membershipType.code,
            discountPercentSnapshot: member.membershipType.discountPercent,
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
            after: { tableNumber: table.number, memberId: member.id },
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
        if (game.status !== GameStatus.IN_PROGRESS)
          throw new ConflictException('Only a live game can be ended.');

        const endTime = new Date();
        const bill = calculateBilling(
          game.startTime,
          endTime,
          game.hourlyRateSnapshot,
          game.discountPercentSnapshot,
        );
        const completed = await tx.gameSession.updateMany({
          where: { id, status: GameStatus.IN_PROGRESS },
          data: {
            status: GameStatus.COMPLETED,
            endTime,
            durationSeconds: bill.durationSeconds,
            baseAmount: bill.baseAmount,
            discountAmount: bill.discountAmount,
            finalAmount: bill.finalAmount,
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
            amount: bill.finalAmount,
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
              finalAmount: bill.finalAmount.toString(),
              receiptNumber: payment.receiptNumber,
            },
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

  async cancel(id: string, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const game = await tx.gameSession.findUnique({ where: { id } });
        if (!game) throw new NotFoundException('Game not found.');
        if (game.status !== GameStatus.IN_PROGRESS)
          throw new ConflictException('Only a live game can be cancelled.');
        const cancelled = await tx.gameSession.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            endTime: new Date(),
            endedById: actorId,
          },
          include: gameInclude,
        });
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
        return cancelled;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private withLiveEstimate<
    T extends {
      status: GameStatus;
      startTime: Date;
      hourlyRateSnapshot: Prisma.Decimal;
      discountPercentSnapshot: Prisma.Decimal;
    },
  >(game: T) {
    if (game.status !== GameStatus.IN_PROGRESS)
      return { ...game, liveEstimate: null };
    const bill = calculateBilling(
      game.startTime,
      new Date(),
      game.hourlyRateSnapshot,
      game.discountPercentSnapshot,
    );
    return {
      ...game,
      liveEstimate: {
        durationSeconds: bill.durationSeconds,
        currentAmount: bill.finalAmount,
      },
    };
  }
}
