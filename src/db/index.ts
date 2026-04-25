import { sql } from '@vercel/postgres';
import { drizzle, VercelPgClient } from 'drizzle-orm/vercel-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

let clientOrPool: VercelPgClient | unknown = sql;

if (process.env.NODE_ENV !== 'production') {
  clientOrPool = new Pool({
    connectionString: `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`,
  });
}

export const db = drizzle(clientOrPool, { schema });
