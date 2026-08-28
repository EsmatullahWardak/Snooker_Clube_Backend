import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    const connectionString = config.getOrThrow<string>('DATABASE_URL');
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit() {
    await this.$connect();
    // Driver adapters can connect lazily, so execute a query before Nest marks
    // the API as ready. A backend without its authoritative database must not
    // accept requests and turn every data operation into an HTTP 500.
    await this.$queryRaw`SELECT 1`;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
