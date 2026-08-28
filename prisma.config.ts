import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Client generation and schema validation do not connect. Runtime startup
    // still rejects a missing DATABASE_URL through Nest configuration.
    url:
      process.env.DATABASE_URL ??
      'postgresql://placeholder:placeholder@localhost:5432/snooker_club',
  },
});
