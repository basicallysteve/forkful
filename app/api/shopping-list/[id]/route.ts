import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { taskRunner } from '@/lib/TaskRunner'
import {
  deleteShoppingListItem,
  updateShoppingListItemDetails,
  updateShoppingListItemStatus,
  type UpdateShoppingListItemDetails,
} from '@/lib/shoppingList'
import type { ShoppingListItemStatus } from '@/types/ShoppingList'

type Params = { params: Promise<{ id: string }> }

const ITEM_STATUSES: readonly ShoppingListItemStatus[] = ['to_buy', 'bought', 'unavailable']

function isItemStatus(value: unknown): value is ShoppingListItemStatus {
  return typeof value === 'string' && (ITEM_STATUSES as readonly string[]).includes(value)
}

function parseId(raw: string): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

// Data-layer price validation errors the route surfaces as 400s rather than 500s.
const DETAIL_VALIDATION_ERRORS = ['Price must be zero or greater', 'Price is too large']

// Parse the optional Line Price / expiration payload into a details patch. Returns an `error` message
// for a malformed field so the route can answer 400. A key that is present must be null or a value of
// the right type; an absent key leaves that field unchanged.
function parseDetailsBody(
  body: { linePrice?: unknown; expirationDate?: unknown },
): { details: UpdateShoppingListItemDetails } | { error: string } {
  const details: UpdateShoppingListItemDetails = {}

  if ('linePrice' in body) {
    const raw = body.linePrice
    if (raw === null) {
      details.linePrice = null
    } else if (typeof raw === 'number' && Number.isFinite(raw)) {
      details.linePrice = raw
    } else {
      return { error: 'linePrice must be a number or null' }
    }
  }

  if ('expirationDate' in body) {
    const raw = body.expirationDate
    if (raw === null) {
      details.expirationDate = null
    } else if (typeof raw === 'string') {
      const parsed = new Date(raw)
      if (Number.isNaN(parsed.getTime())) return { error: 'expirationDate must be an ISO date string or null' }
      details.expirationDate = parsed
    } else {
      return { error: 'expirationDate must be an ISO date string or null' }
    }
  }

  return { details }
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: rawId } = await params
  const id = parseId(rawId)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const deleted = await taskRunner.run(() => deleteShoppingListItem(id, user.userId))
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: rawId } = await params
  const id = parseId(rawId)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // A primitive/array/null body would make the `in` key checks below throw (→ 500). Require a plain
  // object so a malformed body is a clean 400 instead.
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const body = raw as { status?: unknown; linePrice?: unknown; expirationDate?: unknown }

  // A status flip and a details (price/expiration) edit are distinct requests. A `status` key routes to
  // the minimal status update (returns { id, status }); otherwise the body is a details patch, which
  // re-joins and returns the whole line.
  if ('status' in body) {
    if (!isItemStatus(body.status)) {
      return NextResponse.json({ error: 'status must be one of to_buy, bought, unavailable' }, { status: 400 })
    }

    const updated = await taskRunner.run(() => updateShoppingListItemStatus(id, user.userId, body.status as ShoppingListItemStatus))
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(updated)
  }

  const parsed = parseDetailsBody(body)
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  try {
    const updated = await taskRunner.run(() => updateShoppingListItemDetails(id, user.userId, parsed.details))
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof Error && DETAIL_VALIDATION_ERRORS.includes(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    throw error
  }
}
