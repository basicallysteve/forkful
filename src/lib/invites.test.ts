import { describe, it, expect } from 'vitest'
import { generateInviteCode, hashInviteCode, inviteCodeMatchesHash } from './invites'

describe('invite codes', () => {
  it('generates distinct, URL-safe codes with at least 128 bits of entropy', () => {
    const a = generateInviteCode()
    const b = generateInviteCode()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(a.length).toBeGreaterThanOrEqual(22)
  })

  it('hashes to a 64-character SHA-256 hex string that is not the code', () => {
    const code = generateInviteCode()
    const hash = hashInviteCode(code)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).not.toContain(code)
    expect(hashInviteCode(code)).toBe(hash)
  })

  it('matches a code against its stored hash and rejects others', () => {
    const code = generateInviteCode()
    const hash = hashInviteCode(code)
    expect(inviteCodeMatchesHash(code, hash)).toBe(true)
    expect(inviteCodeMatchesHash(generateInviteCode(), hash)).toBe(false)
    expect(inviteCodeMatchesHash('', hash)).toBe(false)
    expect(inviteCodeMatchesHash(code, 'short')).toBe(false)
  })
})
