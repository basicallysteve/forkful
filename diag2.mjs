import 'dotenv/config'
import { readFileSync } from 'fs'
// mimic src/db/index.ts resolution
const env = readFileSync('.env','utf8')
const pick = (k) => (env.match(new RegExp('^'+k+'\\s*=\\s*["\']?([^"\'\\n]+)','m'))||[])[1]
process.env.DATABASE_URL = process.env.DATABASE_URL || pick('DATABASE_POSTGRES_URL')

const { createFoodLogEntry } = await import('./src/lib/foodLog.ts')
import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL, { prepare:false, ssl:'require' })
const [food] = await sql`SELECT id, name FROM foods WHERE date_deleted IS NULL LIMIT 1`
const [user] = await sql`SELECT id FROM users LIMIT 1`
console.log('using food', food, 'user', user.id)
try {
  const entry = await createFoodLogEntry({ userId: user.id, foodId: food.id, amount: 85, unit: 'g', logDate: '2026-08-20' })
  console.log('OK entry id', entry.id)
  await sql`DELETE FROM food_log_entries WHERE id=${entry.id}`
  console.log('cleaned up')
} catch(e) {
  console.log('CREATE ERROR:', e.message)
  console.log('cause:', e.cause?.message)
} finally { await sql.end() }
