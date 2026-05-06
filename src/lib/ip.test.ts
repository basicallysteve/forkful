import { describe, it, expect } from 'vitest'
import { getClientIp } from './ip'

function makeHeaders(map: Record<string, string>): { get(name: string): string | null } {
  return { get: (name: string) => map[name.toLowerCase()] ?? null }
}

describe('getClientIp', () => {
  it('returns the first IP from a multi-entry x-forwarded-for chain', () => {
    expect(getClientIp(makeHeaders({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12' }))).toBe('1.2.3.4')
  })

  it('returns the single IP when x-forwarded-for has one entry', () => {
    expect(getClientIp(makeHeaders({ 'x-forwarded-for': '1.2.3.4' }))).toBe('1.2.3.4')
  })

  it('trims whitespace from the extracted IP', () => {
    expect(getClientIp(makeHeaders({ 'x-forwarded-for': '  1.2.3.4  , 5.6.7.8' }))).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    expect(getClientIp(makeHeaders({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9')
  })

  it('prefers x-forwarded-for over x-real-ip when both are present', () => {
    expect(getClientIp(makeHeaders({ 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '9.9.9.9' }))).toBe('1.2.3.4')
  })

  it('returns unknown when no IP headers are present', () => {
    expect(getClientIp(makeHeaders({}))).toBe('unknown')
  })

  it('handles IPv6 addresses', () => {
    expect(getClientIp(makeHeaders({ 'x-forwarded-for': '::1, 2001:db8::1' }))).toBe('::1')
  })
})
