import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ op: 'eq', a, b })),
  and: vi.fn((...args) => ({ op: 'and', args })),
}))

const mockWhere = vi.fn()
const mockFrom = vi.fn(() => ({ where: mockWhere }))
const mockSelect = vi.fn(() => ({ from: mockFrom }))
const mockReturning = vi.fn()
const mockInsertValues = vi.fn(() => ({ returning: mockReturning }))
const mockInsert = vi.fn(() => ({ values: mockInsertValues }))

vi.mock('@/db', () => ({
  db: {
    get select() { return mockSelect },
    get insert() { return mockInsert },
  },
}))

vi.mock('@/db/schema', () => ({
  users: 'users_table',
  oauthAccounts: 'oauth_accounts_table',
}))

import { deriveUsername, uniqueUsername, findOrCreateOAuthUser } from './oauth'

describe('deriveUsername', () => {
  it('strips non-alphanumeric and lowercases', () => {
    expect(deriveUsername('jane.doe+tag@gmail.com')).toBe('janedoetag')
  })

  it('handles simple email', () => {
    expect(deriveUsername('bob@example.com')).toBe('bob')
  })

  it('falls back to "user" if local part has no alphanumeric chars', () => {
    expect(deriveUsername('---@example.com')).toBe('user')
  })

  it('truncates at 30 chars', () => {
    const long = 'averylongemailaddressthatexceedslimit@example.com'
    expect(deriveUsername(long).length).toBeLessThanOrEqual(30)
  })
})

describe('uniqueUsername', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelect.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ where: mockWhere })
  })

  it('returns base username when no conflict exists', async () => {
    mockWhere.mockResolvedValueOnce([])
    expect(await uniqueUsername('janedoe')).toBe('janedoe')
  })

  it('appends suffix when base is taken', async () => {
    mockWhere
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([])
    expect(await uniqueUsername('janedoe')).toBe('janedoe2')
  })

  it('keeps incrementing suffix until free', async () => {
    mockWhere
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ id: 2 }])
      .mockResolvedValueOnce([{ id: 3 }])
      .mockResolvedValueOnce([])
    expect(await uniqueUsername('bob')).toBe('bob4')
  })
})

describe('findOrCreateOAuthUser', () => {
  const profile = {
    provider: 'google',
    providerAccountId: 'google-123',
    email: 'jane@example.com',
    name: 'Jane Doe',
    avatarUrl: 'https://example.com/avatar.jpg',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSelect.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockInsert.mockReturnValue({ values: mockInsertValues })
    mockInsertValues.mockReturnValue({ returning: mockReturning })
  })

  it('returns existing userId when oauth link already exists', async () => {
    mockWhere.mockResolvedValueOnce([{ userId: 42 }])
    expect(await findOrCreateOAuthUser(profile)).toBe(42)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('links oauth to existing user when email matches', async () => {
    mockWhere
      .mockResolvedValueOnce([])           // no existing oauth link
      .mockResolvedValueOnce([{ id: 7 }]) // existing user by email
    expect(await findOrCreateOAuthUser(profile)).toBe(7)
    expect(mockInsert).toHaveBeenCalledTimes(1)
  })

  it('creates new user and oauth link when neither exists', async () => {
    mockWhere
      .mockResolvedValueOnce([])  // no existing oauth link
      .mockResolvedValueOnce([])  // no existing user by email
      .mockResolvedValueOnce([])  // uniqueUsername: base is free
    mockReturning.mockResolvedValueOnce([{ id: 99 }])

    expect(await findOrCreateOAuthUser(profile)).toBe(99)
    expect(mockInsert).toHaveBeenCalledTimes(2)
  })
})
