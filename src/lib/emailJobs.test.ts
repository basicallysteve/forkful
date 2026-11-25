import { describe, it, expect, vi, beforeEach } from 'vitest'

// Each db.select() chain resolves to the next queued result, in call order.
const results: unknown[][] = []
function chain(): unknown {
  const proxy: unknown = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') {
        const next = results.shift() ?? []
        return (resolve: (v: unknown) => void) => resolve(next)
      }
      return () => proxy
    },
  })
  return proxy
}
vi.mock('@/db', () => ({ db: { select: () => chain() } }))

const lockedIds = new Set<number>()
vi.mock('@/lib/access', () => ({
  hasAccess: vi.fn(async (userId: number) => !lockedIds.has(userId)),
}))

const sendPantryReminderEmail = vi.fn()
const sendRecipeSuggestionEmail = vi.fn()
vi.mock('@/lib/email', () => ({
  sendPantryReminderEmail: (...a: unknown[]) => sendPantryReminderEmail(...a),
  sendRecipeSuggestionEmail: (...a: unknown[]) => sendRecipeSuggestionEmail(...a),
}))

import { processPantryReminders, processRecipeSuggestions } from './emailJobs'

const invited = { id: 1, email: 'invited@example.com', username: 'invited' }
const waitlisted = { id: 2, email: 'waitlisted@example.com', username: 'waitlisted' }
const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)

beforeEach(() => {
  results.length = 0
  lockedIds.clear()
  lockedIds.add(waitlisted.id)
  sendPantryReminderEmail.mockReset()
  sendRecipeSuggestionEmail.mockReset()
})

describe('processPantryReminders skips locked (Waitlisted) accounts', () => {
  it('emails only the Invited user when both have items expiring in 3 days', async () => {
    results.push(
      [invited, waitlisted],
      [
        { userId: 1, name: 'Milk', expirationDate: inThreeDays },
        { userId: 2, name: 'Eggs', expirationDate: inThreeDays },
      ],
    )
    expect(await processPantryReminders('weekly')).toEqual({ sent: 1 })
    expect(sendPantryReminderEmail).toHaveBeenCalledTimes(1)
    expect(sendPantryReminderEmail.mock.calls[0][0].to).toBe(invited.email)
  })
})

describe('processRecipeSuggestions skips locked (Waitlisted) accounts', () => {
  it('emails only the Invited user', async () => {
    const prefs = { cuisinePreferences: [], dietaryRestrictions: [] }
    results.push(
      [{ ...invited, ...prefs }, { ...waitlisted, ...prefs }],
      [{ id: 10, name: 'Soup', description: null, cuisineType: null, dietaryTags: [], shortId: 'abc', slug: 'soup' }],
      [],
      [],
    )
    expect(await processRecipeSuggestions('weekly')).toEqual({ sent: 1 })
    expect(sendRecipeSuggestionEmail).toHaveBeenCalledTimes(1)
    expect(sendRecipeSuggestionEmail.mock.calls[0][0].to).toBe(invited.email)
  })
})
