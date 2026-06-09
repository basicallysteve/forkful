import { sql } from '@vercel/postgres';
import { drizzle, VercelPgClient } from 'drizzle-orm/vercel-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

let clientOrPool: VercelPgClient | Pool = sql as VercelPgClient;

if (process.env.NODE_ENV !== 'production') {
  const connectionString = process.env.POSTGRES_URL ||
    `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_NAME}`;
  clientOrPool = new Pool({ connectionString });
}

// drizzle-orm/vercel-postgres accepts both VercelPgClient and pg.Pool at runtime
export const db = drizzle(clientOrPool as unknown as VercelPgClient, { schema });
