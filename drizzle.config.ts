import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'drizzle-kit';
import { resolveDrizzleEnv } from './src/db/resolveDrizzleEnv';

// drizzle-kit loads `.env` (production) on its own; resolve the URL explicitly instead.
const { url } = resolveDrizzleEnv({
  env: process.env,
  readFile: (name) => {
    const path = join(process.cwd(), name);
    return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
  },
});

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url,
    ssl: process.env.NODE_ENV !== 'test',
  },
});
