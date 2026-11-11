import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { taskRunner } from '@/lib/TaskRunner'
import { scanToBuyShoppingListItem } from '@/lib/shoppingList'
import { isPositiveInteger } from '@/utils/number'

type ScanBody = {
  productId?: unknown
}

// Scan-to-Buy (ADR-0021): the client has already resolved the scanned barcode to a Product (via the
// barcode lookup, or created one inline with the Barcode Creation Modal), so this endpoint takes the
// resolved productId and folds it onto the active list — upgrading a planned Food line, checking off a
// planned Product line, or adding an impulse buy. Returns the resulting line and which of those happened.
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: ScanBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!isPositiveInteger(body.productId)) {
    return NextResponse.json({ error: 'productId must be a positive integer' }, { status: 400 })
  }

  const result = await taskRunner.run(() => scanToBuyShoppingListItem(user.userId, body.productId as number))
  if (!result) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  return NextResponse.json(result, { status: 201 })
}
