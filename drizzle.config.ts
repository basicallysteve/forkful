import { defineConfig } from 'drizzle-kit';

// config({ path: process.env.DRIZZLE_ENV === 'production' ? '.env.production' : '.env' });
console.log('Using database URL:', process.env.DATABASE_POSTGRES_URL);
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_POSTGRES_URL!,
    ssl: true,
  },
});
