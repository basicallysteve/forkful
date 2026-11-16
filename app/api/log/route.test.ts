import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { POST } from './route'
import { getSessionUser } from '@/lib/auth'
import { createFoodLogEntry } from '@/lib/foodLog'

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }))
vi.mock('@/lib/foodLog', () => ({ createFoodLogEntry: vi.fn(), getDailyLog: vi.fn() }))
vi.mock('@/lib/TaskRunner', () => ({
  taskRunner: { run: vi.fn((fn: () => unknown) => fn()) },
}))

function post(extra: Record<string, unknown>) {
  return POST(new Request('http://localhost/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ foodId: 1, amount: 2, unit: 'g', logDate: '2026-11-16', ...extra }),
  }))
}

describe('POST /api/log mealSlot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSessionUser as Mock).mockResolvedValue({ userId: 7 });
    (createFoodLogEntry as Mock).mockResolvedValue({ id: 1 })
  })

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
    ['over 50 characters', 'a'.repeat(51)],
    ['not a string', 123],
  ])('returns 400 for a mealSlot that is %s', async (_label, value) => {
    const res = await post({ mealSlot: value })
    expect(res.status).toBe(400)
    expect(createFoodLogEntry).not.toHaveBeenCalled()
  })

  it('returns 201 and passes the trimmed slot through', async () => {
    const res = await post({ mealSlot: '  Brunch ' })
    expect(res.status).toBe(201)
    expect(createFoodLogEntry).toHaveBeenCalledWith(expect.objectContaining({ mealSlot: 'Brunch' }))
  })

  it('accepts exactly 50 characters', async () => {
    const res = await post({ mealSlot: 'a'.repeat(50) })
    expect(res.status).toBe(201)
  })

  it.each([['omitted', {}], ['null', { mealSlot: null }]])('stores no slot when mealSlot is %s', async (_l, extra) => {
    const res = await post(extra)
    expect(res.status).toBe(201)
    expect(createFoodLogEntry).toHaveBeenCalledWith(expect.objectContaining({ mealSlot: null }))
  })
})
