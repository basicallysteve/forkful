import { NextResponse } from 'next/server'
import { purgeEmptyArchivedShoppingLists } from '@/lib/shoppingList'

export const dynamic = 'force-dynamic'

// Scheduled cleanup: remove archived Shopping Lists that never had a bought line (trips completed with
// nothing purchased). They carry no price history and are already hidden from the history UI, so this
// just reclaims the dead rows. Guarded by the shared CRON_SECRET like the other cron routes.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await purgeEmptyArchivedShoppingLists()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron/purge-empty-shopping-lists]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
