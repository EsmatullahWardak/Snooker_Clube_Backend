import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type AuditClient = Pick<Prisma.TransactionClient, 'auditLog'>;

interface AuditEvent {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(event: AuditEvent, client: AuditClient = this.prisma) {
    return client.auditLog.create({ data: event });
  }
}
