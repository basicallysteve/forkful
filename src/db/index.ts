import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const dbUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.DATABASE_POSTGRES_URL
const ssl = process.env.NODE_ENV === 'test' ? false : ('require' as const)
const client = postgres(dbUrl!, { prepare: false, ssl });

export const db = drizzle(client, { schema });
