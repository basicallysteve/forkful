import { describe, expect, it } from 'vitest'
import { formatPrice } from './currency'

describe('formatPrice', () => {
  it('formats a total with a currency symbol and two decimals', () => {
    expect(formatPrice(4.5)).toBe('$4.50')
    expect(formatPrice(12)).toBe('$12.00')
  })

  it('groups thousands', () => {
    expect(formatPrice(1234.5)).toBe('$1,234.50')
  })
})
