import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: process.env.DRIZZLE_ENV === 'production' ? '.env.production' : '.env.local' });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.POSTGRES_HOST!,
    port: Number(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USER!,
    password: process.env.POSTGRES_PASSWORD!,
    database: process.env.POSTGRES_NAME!,
    ssl: { rejectUnauthorized: false },
  },
});