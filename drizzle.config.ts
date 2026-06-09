import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: process.env.DRIZZLE_ENV === 'production' ? '.env.production' : '.env.local' });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL || `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_NAME}`,
    ssl: { rejectUnauthorized: false },
  },
});