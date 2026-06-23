import { NextResponse } from 'next/server'
import { isNull, eq } from 'drizzle-orm'
import { db } from '@/db'
import { foods } from '@/db/schema'
import { normalizeUSDAFoodName, isUSDANameRaw, AIBudgetExhaustedError } from '@/lib/usda'
import { toSlug } from '@/utils/slug'
import { taskRunner } from '@/lib/TaskRunner'
import {
  sendUSDANormalizationCompleteEmail,
  sendUSDANormalizationPausedEmail,
} from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BATCH_SIZE = 40
const CONCURRENCY = 5

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// Sliding-window rate limiter — serialises the acquire check so concurrent
// callers don't race on the same window state.
class RateLimiter {
  private timestamps: number[] = []
  private chain = Promise.resolve()

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  throttle<T>(fn: () => Promise<T>): Promise<T> {
    const slot = this.chain.then(async () => {
      while (true) {
        const now = Date.now()
        this.timestamps = this.timestamps.filter(t => now - t < this.windowMs)
        if (this.timestamps.length < this.limit) {
          this.timestamps.push(now)
          return
        }
        const waitMs = this.windowMs - (now - this.timestamps[0]) + 50
        await new Promise(r => setTimeout(r, waitMs))
      }
    })
    this.chain = slot.then(() => {}, () => {})
    return slot.then(() => fn())
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Load all non-deleted USDA foods — need all slugs to avoid collisions on update
  const allFoods = await db
    .select({ id: foods.id, name: foods.name, slug: foods.slug, source: foods.source })
    .from(foods)
    .where(isNull(foods.dateDeleted))

  const allSlugs = new Set(allFoods.map(r => r.slug).filter(Boolean) as string[])
  const usdaFoods = allFoods.filter(r => r.source === 'usda')
  const needsNormalization = usdaFoods.filter(r => isUSDANameRaw(r.name))

  // Already complete from a previous run — return without emailing again
  if (needsNormalization.length === 0) {
    return NextResponse.json({ ok: true, status: 'complete', total: usdaFoods.length })
  }

  const batch = needsNormalization.slice(0, BATCH_SIZE)
  const limiter = new RateLimiter(45, 60_000)
  let normalized = 0
  let failed = 0
  let creditExhausted = false

  for (const miniChunk of chunk(batch, CONCURRENCY)) {
    if (creditExhausted) break
    await Promise.all(
      miniChunk.map(async row => {
        if (creditExhausted) return
        let newName: string
        try {
          newName = await limiter.throttle(() => normalizeUSDAFoodName(row.name))
        } catch (err) {
          if (err instanceof AIBudgetExhaustedError) {
            creditExhausted = true
            return
          }
          console.error(`[cron/normalize-usda-names] id=${row.id} error:`, err)
          failed++
          return
        }

        if (newName === row.name) {
          failed++
          return
        }

        let slug = toSlug(newName)
        if (allSlugs.has(slug) && slug !== row.slug) slug = `${slug}-${row.id}`
        allSlugs.add(slug)

        await taskRunner.run(() =>
          db.update(foods)
            .set({ name: newName, slug, dateUpdated: new Date() })
            .where(eq(foods.id, row.id))
        )

        normalized++
      })
    )
  }

  if (creditExhausted) {
    // Remaining = everything we didn't successfully process in this run
    const remaining = needsNormalization.length - normalized
    await sendUSDANormalizationPausedEmail(remaining)
    return NextResponse.json({ ok: true, status: 'paused', normalized, failed, remaining })
  }

  // If this was the last batch and every item was updated, the migration is complete.
  // Failed items will still be raw and retried next run, so only send completion when
  // nothing raw remains after this batch.
  const rawAfterBatch = needsNormalization.length - normalized
  if (rawAfterBatch === 0) {
    await sendUSDANormalizationCompleteEmail(usdaFoods.length, 0)
    return NextResponse.json({ ok: true, status: 'complete', normalized, total: usdaFoods.length })
  }

  return NextResponse.json({ ok: true, status: 'in_progress', normalized, failed, remaining: rawAfterBatch })
}
