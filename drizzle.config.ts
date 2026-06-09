import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: process.env.DRIZZLE_ENV === 'production' ? '.env.production' : '.env' });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_POSTGRES_URL!,
    ssl: true,
  },
});
