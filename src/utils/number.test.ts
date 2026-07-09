import { describe, expect, it } from 'vitest'
import { round2 } from './number'

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
