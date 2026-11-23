import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/db', () => ({ db: {} }))
vi.mock('@/lib/TaskRunner', () => ({ taskRunner: { run: (fn: () => unknown) => fn() } }))

import {
  normalizeEmail,
  isValidWaitlistEmail,
  signWaitlistLeaveToken,
  verifyWaitlistLeaveToken,
} from './waitlist'

beforeEach(() => {
  process.env.AUTH_SECRET = 'test-secret-for-waitlist'
})

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  SAM@Example.com ')).toBe('sam@example.com')
  })
})

describe('isValidWaitlistEmail', () => {
  it.each(['sam@example.com', 'SAM@Example.com', 'a.b+c@sub.example.co'])('accepts %s', (email) => {
    expect(isValidWaitlistEmail(email)).toBe(true)
  })

  it.each(['', '   ', 'sam@', 'sam', '@example.com', 'sam@example', 'a b@example.com'])('rejects %j', (email) => {
    expect(isValidWaitlistEmail(email)).toBe(false)
  })

  it('rejects non-strings and absurdly long values', () => {
    expect(isValidWaitlistEmail(undefined)).toBe(false)
    expect(isValidWaitlistEmail(42)).toBe(false)
    expect(isValidWaitlistEmail(`${'a'.repeat(250)}@example.com`)).toBe(false)
  })
})

describe('leave token', () => {
  it('round-trips the normalized email', () => {
    const token = signWaitlistLeaveToken('Sam@Example.com')
    expect(verifyWaitlistLeaveToken(token)).toBe('sam@example.com')
  })

  it('is URL safe', () => {
    expect(signWaitlistLeaveToken('sam@example.com')).toMatch(/^[A-Za-z0-9_.-]+$/)
  })

  it('rejects a token whose email was swapped', () => {
    const [, sig] = signWaitlistLeaveToken('sam@example.com').split('.')
    const forgedPayload = Buffer.from('other@example.com').toString('base64url')
    expect(verifyWaitlistLeaveToken(`${forgedPayload}.${sig}`)).toBeNull()
  })

  it('rejects a token with a damaged signature', () => {
    const token = signWaitlistLeaveToken('sam@example.com')
    expect(verifyWaitlistLeaveToken(token.slice(0, -2) + 'xx')).toBeNull()
  })

  it('rejects a token signed with a different secret', () => {
    const token = signWaitlistLeaveToken('sam@example.com')
    process.env.AUTH_SECRET = 'a-different-secret'
    expect(verifyWaitlistLeaveToken(token)).toBeNull()
  })

  it.each(['', 'garbage', 'a.b.c', '.', undefined])('rejects malformed token %j', (token) => {
    expect(verifyWaitlistLeaveToken(token as string)).toBeNull()
  })
})
