import { db } from '@/db'
import { foods } from '@/db/schema'
import { isNull } from 'drizzle-orm'
const rows = await db.select({ name: foods.name, source: foods.source }).from(foods).where(isNull(foods.dateDeleted)).limit(10)
console.log(rows.map(r => `[${r.source}] ${r.name}`).join('\n'))
process.exit(0)
