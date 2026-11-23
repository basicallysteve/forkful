import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildInviteLink } from '@/lib/inviteLink'

afterEach(() => vi.unstubAllEnvs())

describe('buildInviteLink', () => {
  it('points at /create-account with the email and code as query params', () => {
    vi.stubEnv('AUTH_URL', 'https://app.example.com')
    const url = new URL(buildInviteLink('pat@example.com', 'abc_DEF-123'))
    expect(url.origin).toBe('https://app.example.com')
    expect(url.pathname).toBe('/create-account')
    expect(url.searchParams.get('email')).toBe('pat@example.com')
    expect(url.searchParams.get('code')).toBe('abc_DEF-123')
  })

  it('url-encodes the email so a plus sign survives the round trip', () => {
    vi.stubEnv('AUTH_URL', 'https://app.example.com')
    const link = buildInviteLink('pat+food@example.com', 'c')
    expect(link).toContain('email=pat%2Bfood%40example.com')
    expect(new URL(link).searchParams.get('email')).toBe('pat+food@example.com')
  })
})
