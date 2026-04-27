import { sql } from '@vercel/postgres';
import { drizzle, VercelPgClient } from 'drizzle-orm/vercel-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

let clientOrPool: VercelPgClient | Pool = sql as VercelPgClient;

if (process.env.NODE_ENV !== 'production') {
  const connectionString = process.env.DATABASE_URL ||
    `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`;
  clientOrPool = new Pool({ connectionString });
}

// drizzle-orm/vercel-postgres accepts both VercelPgClient and pg.Pool at runtime
export const db = drizzle(clientOrPool as unknown as VercelPgClient, { schema });
