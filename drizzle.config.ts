import { defineConfig } from 'drizzle-kit';

const dbUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? process.env.DATABASE_POSTGRES_URL
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: dbUrl!,
    ssl: process.env.NODE_ENV !== 'test',
  },
});
