import { describe, expect, it } from 'vitest'
import { ceil2, round2 } from './number'

describe('round2', () => {
  it('rounds to two decimal places', () => {
    expect(round2(4.005)).toBe(4.01)
    expect(round2(4.004)).toBe(4)
  })

  it('clears binary float artifacts', () => {
    // 0.1 * 3 = 0.30000000000000004 without rounding.
    expect(round2(0.1 * 3)).toBe(0.3)
  })
})

describe('ceil2', () => {
  it('rounds a partial cent up', () => {
    expect(ceil2(3.011)).toBe(3.02)
    expect(ceil2(1.005 * 3)).toBe(3.02) // 3.015 → 3.02
    expect(ceil2(0.001)).toBe(0.01)
  })

  it('leaves a value already at the cent unchanged', () => {
    expect(ceil2(3.01)).toBe(3.01)
    expect(ceil2(6)).toBe(6)
  })

  it('does not bump a clean value up on binary float noise', () => {
    // 0.30 * 100 = 30.000000000000004 — must stay 0.30, not become 0.31.
    expect(ceil2(0.1 * 3)).toBe(0.3)
    expect(ceil2(0.3)).toBe(0.3)
  })
})
