import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const limit = vi.fn()
vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({ innerJoin: () => ({ where: () => ({ limit }) }) }),
    }),
  },
}))

import { hasAccess } from './access'

const ORIGINAL_ADMIN = process.env.ADMIN_USER_ID

beforeEach(() => {
  limit.mockReset()
  process.env.ADMIN_USER_ID = '1'
})
afterEach(() => {
  if (ORIGINAL_ADMIN === undefined) delete process.env.ADMIN_USER_ID
  else process.env.ADMIN_USER_ID = ORIGINAL_ADMIN
})

describe('hasAccess (the one "is this user allowed" check, ADR-0032)', () => {
  it('always allows the admin, without an Invite and without querying', async () => {
    expect(await hasAccess(1)).toBe(true)
    expect(limit).not.toHaveBeenCalled()
  })

  it('allows a user whose email has an Invite', async () => {
    limit.mockResolvedValue([{ id: 5 }])
    expect(await hasAccess(7)).toBe(true)
  })

  it('denies a user with no Invite', async () => {
    limit.mockResolvedValue([])
    expect(await hasAccess(7)).toBe(false)
  })

  it('checks the database on every call, so a revoked Invite locks the next request', async () => {
    limit.mockResolvedValueOnce([{ id: 5 }]).mockResolvedValueOnce([])
    expect(await hasAccess(7)).toBe(true)
    expect(await hasAccess(7)).toBe(false)
    expect(limit).toHaveBeenCalledTimes(2)
  })
})
