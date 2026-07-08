import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { DELETE, PATCH } from './route'
import { deleteShoppingListItem, updateShoppingListItemDetails, updateShoppingListItemStatus } from '@/lib/shoppingList'
import { getSessionUser } from '@/lib/auth'

vi.mock('@/lib/shoppingList', () => ({
  deleteShoppingListItem: vi.fn(),
  updateShoppingListItemStatus: vi.fn(),
  updateShoppingListItemDetails: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getSessionUser: vi.fn(),
}))

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function patchRequest(body: unknown) {
  return new Request('http://localhost/api/shopping-list/1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DELETE /api/shopping-list/[id]', () => {
  it('returns 401 when there is no session', async () => {
    (getSessionUser as Mock).mockResolvedValue(null)

    const res = await DELETE(new Request('http://localhost/api/shopping-list/1'), makeParams('1'))

    expect(res.status).toBe(401)
    expect(deleteShoppingListItem).not.toHaveBeenCalled()
  })

  it('returns 400 for a non-numeric id', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })

    const res = await DELETE(new Request('http://localhost/api/shopping-list/foo'), makeParams('foo'))

    expect(res.status).toBe(400)
    expect(deleteShoppingListItem).not.toHaveBeenCalled()
  })

  it('returns 404 when the line is not found or not on the session user’s active list', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (deleteShoppingListItem as Mock).mockResolvedValue(false)

    const res = await DELETE(new Request('http://localhost/api/shopping-list/1'), makeParams('1'))

    expect(res.status).toBe(404)
    expect(deleteShoppingListItem).toHaveBeenCalledWith(1, 42)
  })

  it('returns 204 and scopes the delete to the session user on success', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (deleteShoppingListItem as Mock).mockResolvedValue(true)

    const res = await DELETE(new Request('http://localhost/api/shopping-list/1'), makeParams('1'))

    expect(res.status).toBe(204)
    expect(deleteShoppingListItem).toHaveBeenCalledWith(1, 42)
  })
})

describe('PATCH /api/shopping-list/[id]', () => {
  it('returns 401 when there is no session', async () => {
    (getSessionUser as Mock).mockResolvedValue(null)

    const res = await PATCH(patchRequest({ status: 'bought' }), makeParams('1'))

    expect(res.status).toBe(401)
    expect(updateShoppingListItemStatus).not.toHaveBeenCalled()
  })

  it('returns 400 for a non-numeric id', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })

    const res = await PATCH(patchRequest({ status: 'bought' }), makeParams('foo'))

    expect(res.status).toBe(400)
    expect(updateShoppingListItemStatus).not.toHaveBeenCalled()
  })

  it('returns 400 (not 500) when the JSON body is a primitive rather than an object', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })

    // A bare JSON number would make the `in` key checks throw if it weren't guarded.
    const res = await PATCH(patchRequest(5), makeParams('1'))

    expect(res.status).toBe(400)
    expect(updateShoppingListItemStatus).not.toHaveBeenCalled()
    expect(updateShoppingListItemDetails).not.toHaveBeenCalled()
  })

  it('returns 400 for a status outside the allowed set', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })

    const res = await PATCH(patchRequest({ status: 'in_cart' }), makeParams('1'))

    expect(res.status).toBe(400)
    expect(updateShoppingListItemStatus).not.toHaveBeenCalled()
  })

  it('returns 404 when the line is not on the session user’s active list', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (updateShoppingListItemStatus as Mock).mockResolvedValue(null)

    const res = await PATCH(patchRequest({ status: 'bought' }), makeParams('1'))

    expect(res.status).toBe(404)
    expect(updateShoppingListItemStatus).toHaveBeenCalledWith(1, 42, 'bought')
  })

  it('returns 200 with the updated id and status, scoped to the session user', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })
    const updated = { id: 1, status: 'unavailable' };
    (updateShoppingListItemStatus as Mock).mockResolvedValue(updated)

    const res = await PATCH(patchRequest({ status: 'unavailable' }), makeParams('1'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(updated)
    expect(updateShoppingListItemStatus).toHaveBeenCalledWith(1, 42, 'unavailable')
  })
})

describe('PATCH /api/shopping-list/[id] — price & expiration', () => {
  it('updates the Line Price and expiration when no status is present, returning the full line', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })
    const updated = { id: 1, linePrice: 4.5, expirationDate: '2026-02-01T00:00:00.000Z' };
    (updateShoppingListItemDetails as Mock).mockResolvedValue(updated)

    const res = await PATCH(patchRequest({ linePrice: 4.5, expirationDate: '2026-02-01T00:00:00.000Z' }), makeParams('1'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(updated)
    expect(updateShoppingListItemDetails).toHaveBeenCalledWith(1, 42, {
      linePrice: 4.5,
      expirationDate: new Date('2026-02-01T00:00:00.000Z'),
    })
    expect(updateShoppingListItemStatus).not.toHaveBeenCalled()
  })

  it('passes explicit nulls through to clear the price and expiration', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (updateShoppingListItemDetails as Mock).mockResolvedValue({ id: 1 })

    await PATCH(patchRequest({ linePrice: null, expirationDate: null }), makeParams('1'))

    expect(updateShoppingListItemDetails).toHaveBeenCalledWith(1, 42, { linePrice: null, expirationDate: null })
  })

  it('returns 400 for a non-numeric linePrice', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })

    const res = await PATCH(patchRequest({ linePrice: 'free' }), makeParams('1'))

    expect(res.status).toBe(400)
    expect(updateShoppingListItemDetails).not.toHaveBeenCalled()
  })

  it('returns 400 for an unparseable expiration date', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })

    const res = await PATCH(patchRequest({ expirationDate: 'not-a-date' }), makeParams('1'))

    expect(res.status).toBe(400)
    expect(updateShoppingListItemDetails).not.toHaveBeenCalled()
  })

  it('surfaces a data-layer price range error as a 400', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (updateShoppingListItemDetails as Mock).mockRejectedValue(new Error('Price must be zero or greater'))

    const res = await PATCH(patchRequest({ linePrice: -1 }), makeParams('1'))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Price must be zero or greater' })
  })

  it('returns 404 when the line is not on the session user’s active list', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (updateShoppingListItemDetails as Mock).mockResolvedValue(null)

    const res = await PATCH(patchRequest({ linePrice: 2 }), makeParams('1'))

    expect(res.status).toBe(404)
  })
})
