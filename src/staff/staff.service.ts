import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { paginationMeta } from '../common/dto/pagination.dto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto, StaffQueryDto, UpdateStaffDto } from './dto/staff.dto';

const publicStaffSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, name: true, description: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: StaffQueryDto) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      status: query.status,
      ...(query.role ? { role: { name: query.role } } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: publicStaffSelect,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data, meta: paginationMeta(query.page, query.pageSize, total) };
  }

  async get(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: publicStaffSelect,
    });
    if (!user) throw new NotFoundException('Staff user not found.');
    return user;
  }

  async create(dto: CreateStaffDto, actorId: string) {
    const role = await this.prisma.role.findUnique({
      where: { name: dto.role },
    });
    if (!role) throw new NotFoundException('Role not found.');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email,
            passwordHash: await bcrypt.hash(dto.password, 12),
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: dto.phone,
            roleId: role.id,
          },
          select: publicStaffSelect,
        });
        await this.audit.record(
          {
            actorId,
            action: 'STAFF_CREATED',
            resourceType: 'User',
            resourceId: user.id,
            after: { email: user.email, role: user.role.name },
          },
          tx,
        );
        return user;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A staff user with this email already exists.',
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateStaffDto, actorId: string) {
    const existing = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { role: true },
    });
    if (!existing) throw new NotFoundException('Staff user not found.');
    if (id === actorId && dto.status === 'INACTIVE')
      throw new ConflictException('You cannot deactivate your own account.');
    const role = dto.role
      ? await this.prisma.role.findUnique({ where: { name: dto.role } })
      : null;
    if (dto.role && !role) throw new NotFoundException('Role not found.');

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          roleId: role?.id,
          status: dto.status,
          passwordHash: dto.password
            ? await bcrypt.hash(dto.password, 12)
            : undefined,
        },
        select: publicStaffSelect,
      });
      await this.audit.record(
        {
          actorId,
          action: 'STAFF_UPDATED',
          resourceType: 'User',
          resourceId: id,
          before: { role: existing.role.name, status: existing.status },
          after: { role: user.role.name, status: user.status },
        },
        tx,
      );
      return user;
    });
  }
}
