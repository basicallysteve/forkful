import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { DELETE, PATCH } from './route'
import { deleteShoppingListItem, updateShoppingListItemStatus } from '@/lib/shoppingList'
import { getSessionUser } from '@/lib/auth'

vi.mock('@/lib/shoppingList', () => ({
  deleteShoppingListItem: vi.fn(),
  updateShoppingListItemStatus: vi.fn(),
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

  it('returns 200 with the updated line, scoped to the session user', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })
    const updated = { id: 1, sourceType: 'food', status: 'unavailable', name: 'Milk', amount: 1, unit: 'each' };
    (updateShoppingListItemStatus as Mock).mockResolvedValue(updated)

    const res = await PATCH(patchRequest({ status: 'unavailable' }), makeParams('1'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(updated)
    expect(updateShoppingListItemStatus).toHaveBeenCalledWith(1, 42, 'unavailable')
  })
})
