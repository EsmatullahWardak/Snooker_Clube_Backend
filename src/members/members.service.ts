import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { paginationMeta } from '../common/dto/pagination.dto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateMemberDto,
  MemberQueryDto,
  UpdateMemberDto,
} from './dto/member.dto';

const memberInclude = {
  membershipType: true,
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  updatedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.MemberInclude;

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: MemberQueryDto) {
    const where: Prisma.MemberWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.activeOnly ? { status: 'ACTIVE' } : {}),
      ...(query.membershipCode
        ? { membershipType: { code: query.membershipCode } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              {
                membershipNumber: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              { phone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [
      data,
      total,
      allMembers,
      proPlayers,
      standardMembers,
      inactiveMembers,
    ] = await this.prisma.$transaction([
      this.prisma.member.findMany({
        where,
        include: memberInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.member.count({ where }),
      this.prisma.member.count({ where: { deletedAt: null } }),
      this.prisma.member.count({
        where: { deletedAt: null, membershipType: { code: 'PRO_PLAYER' } },
      }),
      this.prisma.member.count({
        where: { deletedAt: null, membershipType: { code: 'STANDARD' } },
      }),
      this.prisma.member.count({
        where: { deletedAt: null, status: 'INACTIVE' },
      }),
    ]);
    return {
      data,
      meta: paginationMeta(query.page, query.pageSize, total),
      summary: {
        totalMembers: allMembers,
        proPlayers,
        standardMembers,
        inactiveMembers,
      },
    };
  }

  async get(id: string) {
    const [member, gameStats] = await this.prisma.$transaction([
      this.prisma.member.findFirst({
        where: { id, deletedAt: null },
        include: {
          ...memberInclude,
          games: {
            orderBy: { startTime: 'desc' },
            take: 10,
            include: {
              table: { select: { number: true, name: true } },
              payment: true,
            },
          },
          payments: { orderBy: { paymentDate: 'desc' }, take: 10 },
        },
      }),
      this.prisma.gameSession.aggregate({
        where: { memberId: id, status: 'COMPLETED' },
        _count: { _all: true },
        _sum: { durationSeconds: true, finalAmount: true },
      }),
    ]);
    if (!member) throw new NotFoundException('Member not found.');
    return {
      ...member,
      stats: {
        totalGames: gameStats._count._all,
        totalDurationSeconds: gameStats._sum.durationSeconds ?? 0,
        totalSpent: gameStats._sum.finalAmount ?? new Prisma.Decimal(0),
      },
    };
  }

  async create(dto: CreateMemberDto, actorId: string) {
    const membershipType = await this.prisma.membershipType.findFirst({
      where: { code: dto.membershipCode, isActive: true },
    });
    if (!membershipType)
      throw new NotFoundException('Membership type is not available.');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const member = await tx.member.create({
          data: {
            membershipNumber: `MEM-${randomUUID().slice(0, 8).toUpperCase()}`,
            name: dto.name,
            fatherName: dto.fatherName,
            phone: dto.phone,
            email: dto.email,
            address: dto.address,
            photoUrl: dto.photoUrl,
            membershipTypeId: membershipType.id,
            startDate: dto.startDate ? new Date(dto.startDate) : undefined,
            endDate: dto.endDate ? new Date(dto.endDate) : undefined,
            createdById: actorId,
            updatedById: actorId,
          },
          include: memberInclude,
        });
        await this.audit.record(
          {
            actorId,
            action: 'MEMBER_CREATED',
            resourceType: 'Member',
            resourceId: member.id,
            after: {
              membershipNumber: member.membershipNumber,
              name: member.name,
            },
          },
          tx,
        );
        return member;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A member with this email or membership number already exists.',
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateMemberDto, actorId: string) {
    const existing = await this.prisma.member.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Member not found.');

    const membershipType = dto.membershipCode
      ? await this.prisma.membershipType.findFirst({
          where: { code: dto.membershipCode, isActive: true },
        })
      : null;
    if (dto.membershipCode && !membershipType)
      throw new NotFoundException('Membership type is not available.');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const member = await tx.member.update({
          where: { id },
          data: {
            name: dto.name,
            fatherName: dto.fatherName,
            phone: dto.phone,
            email: dto.email,
            address: dto.address,
            photoUrl: dto.photoUrl,
            status: dto.status,
            membershipTypeId: membershipType?.id,
            startDate: dto.startDate ? new Date(dto.startDate) : undefined,
            endDate: dto.endDate ? new Date(dto.endDate) : undefined,
            updatedById: actorId,
          },
          include: memberInclude,
        });
        await this.audit.record(
          {
            actorId,
            action: 'MEMBER_UPDATED',
            resourceType: 'Member',
            resourceId: id,
            before: { name: existing.name, status: existing.status },
            after: { name: member.name, status: member.status },
          },
          tx,
        );
        return member;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'That email is already assigned to another member.',
        );
      }
      throw error;
    }
  }
}
