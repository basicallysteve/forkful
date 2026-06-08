import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { GET, PUT, DELETE } from './route'
import { getPantryItemById, updatePantryItem, deletePantryItem } from '@/lib/pantry'
import { getSessionUser } from '@/lib/auth'

vi.mock('@/lib/pantry', () => ({
  getPantryItemById: vi.fn(),
  updatePantryItem: vi.fn(),
  deletePantryItem: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getSessionUser: vi.fn(),
}))

const mockItem = {
  id: 1,
  food: { id: 1, name: 'Chicken' },
  originalSize: { size: 16, unit: 'oz' },
  currentSize: { size: 8, unit: 'oz' },
  expirationDate: null,
  addedDate: new Date('2026-01-01'),
  status: 'good' as const,
  frozenDate: null,
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function createPutRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/pantry/1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/pantry/[id]', () => {
  it('returns 401 when there is no session', async () => {
    (getSessionUser as Mock).mockResolvedValue(null)

    const res = await GET(new Request('http://localhost/api/pantry/1'), makeParams('1'))

    expect(res.status).toBe(401)
    expect(getPantryItemById).not.toHaveBeenCalled()
  })

  it('returns 404 when the item does not belong to the session user', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    // Data layer enforces ownership and returns null for cross-user reads
    (getPantryItemById as Mock).mockResolvedValue(null)

    const res = await GET(new Request('http://localhost/api/pantry/1'), makeParams('1'))

    expect(res.status).toBe(404)
    expect(getPantryItemById).toHaveBeenCalledWith(1, 42)
  })

  it('returns the item when owned by the session user', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (getPantryItemById as Mock).mockResolvedValue(mockItem)

    const res = await GET(new Request('http://localhost/api/pantry/1'), makeParams('1'))

    expect(res.status).toBe(200)
    expect(getPantryItemById).toHaveBeenCalledWith(1, 42)
    const body = await res.json()
    expect(body.id).toBe(1)
  })
})

describe('PUT /api/pantry/[id]', () => {
  it('returns 401 when there is no session', async () => {
    (getSessionUser as Mock).mockResolvedValue(null)

    const res = await PUT(createPutRequest({ currentSizeAmount: 4 }), makeParams('1'))

    expect(res.status).toBe(401)
    expect(updatePantryItem).not.toHaveBeenCalled()
  })

  it('returns 404 when item is not found or not owned by session user', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (updatePantryItem as Mock).mockResolvedValue(null)

    const res = await PUT(createPutRequest({ currentSizeAmount: 4 }), makeParams('1'))

    expect(res.status).toBe(404)
  })

  it('parses date strings into Date objects before calling updatePantryItem', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (getPantryItemById as Mock).mockResolvedValue(mockItem);
    (updatePantryItem as Mock).mockResolvedValue(mockItem)

    await PUT(
      createPutRequest({
        expirationDate: '2026-12-31',
        frozenDate: '2026-05-01',
        currentSizeAmount: 4,
      }),
      makeParams('1'),
    )

    expect(updatePantryItem).toHaveBeenCalledWith(
      1,
      42,
      expect.objectContaining({
        expirationDate: expect.any(Date),
        frozenDate: expect.any(Date),
        currentSizeAmount: 4,
      }),
    )
  })

  it('preserves null for explicit null date fields (thaw / clear expiration)', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (getPantryItemById as Mock).mockResolvedValue(mockItem);
    (updatePantryItem as Mock).mockResolvedValue(mockItem)

    await PUT(
      createPutRequest({ frozenDate: null, expirationDate: null }),
      makeParams('1'),
    )

    expect(updatePantryItem).toHaveBeenCalledWith(
      1,
      42,
      expect.objectContaining({ frozenDate: null, expirationDate: null }),
    )
  })

  it('does not include fields that were omitted from the body', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (getPantryItemById as Mock).mockResolvedValue(mockItem);
    (updatePantryItem as Mock).mockResolvedValue(mockItem)

    await PUT(createPutRequest({ currentSizeAmount: 4 }), makeParams('1'))

    const [, , data] = (updatePantryItem as Mock).mock.calls[0]
    expect(data).toEqual({ currentSizeAmount: 4 })
    expect(data).not.toHaveProperty('expirationDate')
    expect(data).not.toHaveProperty('frozenDate')
  })
})

describe('DELETE /api/pantry/[id]', () => {
  it('returns 401 when there is no session', async () => {
    (getSessionUser as Mock).mockResolvedValue(null)

    const res = await DELETE(new Request('http://localhost/api/pantry/1'), makeParams('1'))

    expect(res.status).toBe(401)
    expect(deletePantryItem).not.toHaveBeenCalled()
  })

  it('returns 404 when item is not found or not owned by session user', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (deletePantryItem as Mock).mockResolvedValue(false)

    const res = await DELETE(new Request('http://localhost/api/pantry/1'), makeParams('1'))

    expect(res.status).toBe(404)
  })

  it('returns 204 and scopes the delete to the session user on success', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' });
    (getPantryItemById as Mock).mockResolvedValue(mockItem);
    (deletePantryItem as Mock).mockResolvedValue(true)

    const res = await DELETE(new Request('http://localhost/api/pantry/1'), makeParams('1'))

    expect(res.status).toBe(204)
    expect(deletePantryItem).toHaveBeenCalledWith(1, 42)
  })
})
