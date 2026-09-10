import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get() {
    const [settings, membershipTypes] = await Promise.all([
      this.prisma.clubSetting.findUnique({ where: { id: 'default' } }),
      this.prisma.membershipType.findMany({ orderBy: { name: 'asc' } }),
    ]);
    if (!settings) throw new NotFoundException('Club settings are missing.');
    return { ...settings, membershipTypes };
  }

  async update(dto: UpdateSettingsDto, actorId: string) {
    const current = await this.prisma.clubSetting.findUnique({
      where: { id: 'default' },
    });
    if (!current) throw new NotFoundException('Club settings are missing.');

    return this.prisma.$transaction(async (tx) => {
      const settings = await tx.clubSetting.update({
        where: { id: 'default' },
        data: {
          clubName: dto.clubName,
          defaultHourlyRate: dto.defaultHourlyRate,
          currency: dto.currency,
          timezone: dto.timezone,
          updatedById: actorId,
        },
      });
      await this.audit.record(
        {
          actorId,
          action: 'SETTINGS_UPDATED',
          resourceType: 'ClubSetting',
          resourceId: 'default',
          before: {
            clubName: current.clubName,
            defaultHourlyRate: current.defaultHourlyRate.toString(),
          },
          after: {
            clubName: settings.clubName,
            defaultHourlyRate: settings.defaultHourlyRate.toString(),
          },
        },
        tx,
      );
      const memberships = await tx.membershipType.findMany({
        orderBy: { name: 'asc' },
      });
      return { ...settings, membershipTypes: memberships };
    });
  }
}
