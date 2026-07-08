import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { POST } from './route'
import { splitShoppingListItem } from '@/lib/shoppingList'
import { getSessionUser } from '@/lib/auth'

vi.mock('@/lib/shoppingList', () => ({
  splitShoppingListItem: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getSessionUser: vi.fn(),
}))

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function postRequest(body: unknown) {
  return new Request('http://localhost/api/shopping-list/1/split', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/shopping-list/[id]/split', () => {
  it('returns 401 when there is no session', async () => {
    (getSessionUser as Mock).mockResolvedValue(null)

    const res = await POST(postRequest({ portions: [{ amount: 1, expirationDate: null }] }), makeParams('1'))

    expect(res.status).toBe(401)
    expect(splitShoppingListItem).not.toHaveBeenCalled()
  })

  it('returns 400 for a non-numeric id', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })

    const res = await POST(postRequest({ portions: [{ amount: 1, expirationDate: null }] }), makeParams('foo'))

    expect(res.status).toBe(400)
    expect(splitShoppingListItem).not.toHaveBeenCalled()
  })

  it('returns 400 when portions is missing or empty', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })

    expect((await POST(postRequest({}), makeParams('1'))).status).toBe(400)
    expect((await POST(postRequest({ portions: [] }), makeParams('1'))).status).toBe(400)
    expect(splitShoppingListItem).not.toHaveBeenCalled()
  })

  it('returns 400 for a portion with a non-positive amount', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })

    const res = await POST(postRequest({ portions: [{ amount: 0, expirationDate: null }] }), makeParams('1'))

    expect(res.status).toBe(400)
    expect(splitShoppingListItem).not.toHaveBeenCalled()
  })

  it('returns 400 for a portion with an unparseable expiration date', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })

    const res = await POST(postRequest({ portions: [{ amount: 1, expirationDate: 'not-a-date' }] }), makeParams('1'))

    expect(res.status).toBe(400)
    expect(splitShoppingListItem).not.toHaveBeenCalled()
  })

  it('parses portions and an optional linePrice, scoped to the session user', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })
    const items = [{ id: 1 }, { id: 2 }];
    (splitShoppingListItem as Mock).mockResolvedValue(items)

    const res = await POST(postRequest({
      portions: [
        { amount: 1, expirationDate: '2026-02-01T00:00:00.000Z' },
        { amount: 1, expirationDate: null },
      ],
      linePrice: 6,
    }), makeParams('1'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(items)
    expect(splitShoppingListItem).toHaveBeenCalledWith(
      1,
      42,
      [
        { amount: 1, expirationDate: new Date('2026-02-01T00:00:00.000Z') },
        { amount: 1, expirationDate: null },
      ],
      { linePrice: 6 },
    )
  })

  it('passes an explicit null linePrice through to clear it', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (splitShoppingListItem as Mock).mockResolvedValue([{ id: 1 }])

    await POST(postRequest({ portions: [{ amount: 2, expirationDate: null }], linePrice: null }), makeParams('1'))

    expect(splitShoppingListItem).toHaveBeenCalledWith(1, 42, [{ amount: 2, expirationDate: null }], { linePrice: null })
  })

  it('surfaces a data-layer sum mismatch as a 400', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (splitShoppingListItem as Mock).mockRejectedValue(new Error('Portions must sum to the line amount'))

    const res = await POST(postRequest({ portions: [{ amount: 1, expirationDate: null }] }), makeParams('1'))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Portions must sum to the line amount' })
  })

  it('returns 404 when the line is not on the session user’s active list', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (splitShoppingListItem as Mock).mockResolvedValue(null)

    const res = await POST(postRequest({ portions: [{ amount: 2, expirationDate: null }] }), makeParams('1'))

    expect(res.status).toBe(404)
  })
})
