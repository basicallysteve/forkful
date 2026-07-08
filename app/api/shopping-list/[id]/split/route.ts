import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { taskRunner } from '@/lib/TaskRunner'
import { splitShoppingListItem, type ShoppingListItemPortion } from '@/lib/shoppingList'

type Params = { params: Promise<{ id: string }> }

function parseId(raw: string): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

// Data-layer validation errors the route surfaces as 400s rather than 500s.
const VALIDATION_ERRORS = [
  'At least one portion is required',
  'Portions must sum to the line amount',
  'Amount must be greater than zero',
  'Amount is too large',
  'Price must be zero or greater',
  'Price is too large',
]

type SplitBody = {
  portions?: unknown
  linePrice?: unknown
}

// Parse one { amount, expirationDate } portion. Amount must be a positive number; expirationDate must
// be an ISO date string or null (absent is treated as null).
function parsePortion(raw: unknown): ShoppingListItemPortion | { error: string } {
  if (typeof raw !== 'object' || raw === null) return { error: 'each portion must be an object' }
  const portion = raw as { amount?: unknown; expirationDate?: unknown }

  if (typeof portion.amount !== 'number' || !Number.isFinite(portion.amount) || portion.amount <= 0) {
    return { error: 'each portion amount must be a positive number' }
  }

  let expirationDate: Date | null = null
  if (portion.expirationDate != null) {
    if (typeof portion.expirationDate !== 'string') {
      return { error: 'each portion expirationDate must be an ISO date string or null' }
    }
    const parsed = new Date(portion.expirationDate)
    if (Number.isNaN(parsed.getTime())) {
      return { error: 'each portion expirationDate must be an ISO date string or null' }
    }
    expirationDate = parsed
  }

  return { amount: portion.amount, expirationDate }
}

export async function POST(request: Request, { params }: Params) {
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
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const body = raw as SplitBody

  if (!Array.isArray(body.portions) || body.portions.length === 0) {
    return NextResponse.json({ error: 'portions must be a non-empty array' }, { status: 400 })
  }

  const portions: ShoppingListItemPortion[] = []
  for (const rawPortion of body.portions) {
    const parsed = parsePortion(rawPortion)
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    portions.push(parsed)
  }

  const options: { linePrice?: number | null } = {}
  if ('linePrice' in body) {
    if (body.linePrice === null) {
      options.linePrice = null
    } else if (typeof body.linePrice === 'number' && Number.isFinite(body.linePrice)) {
      options.linePrice = body.linePrice
    } else {
      return NextResponse.json({ error: 'linePrice must be a number or null' }, { status: 400 })
    }
  }

  try {
    const items = await taskRunner.run(() => splitShoppingListItem(id, user.userId, portions, options))
    if (!items) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(items)
  } catch (error) {
    if (error instanceof Error && VALIDATION_ERRORS.includes(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    throw error
  }
}
