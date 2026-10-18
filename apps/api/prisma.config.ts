import { defineConfig } from 'prisma/config';

// `prisma generate` does not connect to the database, so a URL is only required for migrate commands.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
