import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const VIP_TABLE_NUMBER = 6;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get() {
    const [settings, membershipTypes, vipTable] = await Promise.all([
      this.prisma.clubSetting.findUnique({ where: { id: 'default' } }),
      this.prisma.membershipType.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.snookerTable.findUnique({
        where: { number: VIP_TABLE_NUMBER },
      }),
    ]);
    if (!settings) throw new NotFoundException('Club settings are missing.');
    if (!vipTable) throw new NotFoundException('VIP table is missing.');
    return {
      ...settings,
      vipHourlyRate: vipTable.hourlyRateOverride ?? settings.defaultHourlyRate,
      membershipTypes,
    };
  }

  async update(dto: UpdateSettingsDto, actorId: string) {
    const [current, currentVipTable] = await Promise.all([
      this.prisma.clubSetting.findUnique({ where: { id: 'default' } }),
      this.prisma.snookerTable.findUnique({
        where: { number: VIP_TABLE_NUMBER },
      }),
    ]);
    if (!current) throw new NotFoundException('Club settings are missing.');
    if (!currentVipTable) throw new NotFoundException('VIP table is missing.');

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
      const vipTable =
        dto.vipHourlyRate === undefined
          ? currentVipTable
          : await tx.snookerTable.update({
              where: { id: currentVipTable.id },
              data: { hourlyRateOverride: dto.vipHourlyRate },
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
            vipHourlyRate: (
              currentVipTable.hourlyRateOverride ?? current.defaultHourlyRate
            ).toString(),
          },
          after: {
            clubName: settings.clubName,
            defaultHourlyRate: settings.defaultHourlyRate.toString(),
            vipHourlyRate: (
              vipTable.hourlyRateOverride ?? settings.defaultHourlyRate
            ).toString(),
          },
        },
        tx,
      );
      const memberships = await tx.membershipType.findMany({
        orderBy: { name: 'asc' },
      });
      return {
        ...settings,
        vipHourlyRate:
          vipTable.hourlyRateOverride ?? settings.defaultHourlyRate,
        membershipTypes: memberships,
      };
    });
  }
}
