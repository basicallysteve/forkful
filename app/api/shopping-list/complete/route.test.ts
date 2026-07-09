import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { POST } from './route'
import { completeShoppingTrip } from '@/lib/shoppingList'
import { getSessionUser } from '@/lib/auth'

vi.mock('@/lib/shoppingList', () => ({
  completeShoppingTrip: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getSessionUser: vi.fn(),
}))

function completeRequest(body: unknown) {
  return new Request('http://localhost/api/shopping-list/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/shopping-list/complete', () => {
  it('returns 401 when there is no session', async () => {
    (getSessionUser as Mock).mockResolvedValue(null)

    const res = await POST(completeRequest({ keepUnbought: true }))

    expect(res.status).toBe(401)
    expect(completeShoppingTrip).not.toHaveBeenCalled()
  })

  it('returns 400 when keepUnbought is missing or not a boolean', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })

    const res = await POST(completeRequest({ keepUnbought: 'yes' }))

    expect(res.status).toBe(400)
    expect(completeShoppingTrip).not.toHaveBeenCalled()
  })

  it('returns 400 for a non-object body', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })

    const res = await POST(completeRequest([1, 2, 3]))

    expect(res.status).toBe(400)
    expect(completeShoppingTrip).not.toHaveBeenCalled()
  })

  it('returns 404 when the user has no active list', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (completeShoppingTrip as Mock).mockResolvedValue(null)

    const res = await POST(completeRequest({ keepUnbought: false }))

    expect(res.status).toBe(404)
    expect(completeShoppingTrip).toHaveBeenCalledWith(42, { keepUnbought: false })
  })

  it('completes the trip and returns the result, scoped to the session user', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })
    const result = { pantryItemsCreated: 2, keptCount: 1, droppedCount: 0, items: [] };
    (completeShoppingTrip as Mock).mockResolvedValue(result)

    const res = await POST(completeRequest({ keepUnbought: true }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(result)
    expect(completeShoppingTrip).toHaveBeenCalledWith(42, { keepUnbought: true })
  })
})
