import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { DELETE } from './route'
import { deleteShoppingListItem } from '@/lib/shoppingList'
import { getSessionUser } from '@/lib/auth'

vi.mock('@/lib/shoppingList', () => ({
  deleteShoppingListItem: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getSessionUser: vi.fn(),
}))

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
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
