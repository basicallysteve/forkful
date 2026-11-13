import { describe, it, expect } from 'vitest'
import { parseQuantity, formatQuantity, stepQuantity } from './quantity'

describe('parseQuantity', () => {
  it.each([
    ['½', 0.5],
    ['1/2', 0.5],
    ['1 1/2', 1.5],
    ['1½', 1.5],
    ['1 ½', 1.5],
    ['0.5', 0.5],
    ['.5', 0.5],
    ['2', 2],
    ['  2  ', 2],
    ['1/3', 1 / 3],
    ['¾', 0.75],
  ])('parses %j as %d', (input, expected) => {
    expect(parseQuantity(input)).toBeCloseTo(expected, 10)
  })

  it.each(['', '   ', 'abc', '1/0', '-1', '-1/2', '1,5', '1,000', '1/', '/2', '1.2.3', '1 1/2/3', '½½'])(
    'rejects %j',
    (input) => {
      expect(parseQuantity(input)).toBeNull()
    },
  )
})

describe('formatQuantity', () => {
  it('uses fractions for count units', () => {
    expect(formatQuantity(0.5, 'slice')).toBe('½')
    expect(formatQuantity(1.5, 'piece')).toBe('1½')
    expect(formatQuantity(0.125, 'can')).toBe('⅛')
    expect(formatQuantity(0.25, 'serving')).toBe('¼')
    expect(formatQuantity(1 / 3, 'slice')).toBe('⅓')
    expect(formatQuantity(2 / 3, 'slice')).toBe('⅔')
    expect(formatQuantity(2.75, 'slice')).toBe('2¾')
    expect(formatQuantity(3, 'slice')).toBe('3')
  })

  it('uses decimals for g and ml', () => {
    expect(formatQuantity(0.5, 'g')).toBe('0.5')
    expect(formatQuantity(1.25, 'ml')).toBe('1.25')
    expect(formatQuantity(100, 'g')).toBe('100')
  })

  it('falls back to a trimmed decimal when no fraction matches', () => {
    expect(formatQuantity(0.4, 'slice')).toBe('0.4')
    expect(formatQuantity(1.37, 'slice')).toBe('1.37')
  })

  it('round-trips through parseQuantity', () => {
    for (const v of [0.5, 1.5, 2.25, 0.75, 3]) {
      expect(parseQuantity(formatQuantity(v, 'slice'))).toBeCloseTo(v, 10)
    }
  })
})

describe('stepQuantity', () => {
  it('steps g and ml by 1', () => {
    expect(stepQuantity(100, 1, 'g')).toBe(101)
    expect(stepQuantity(100, -1, 'ml')).toBe(99)
  })

  it('steps count units by a quarter', () => {
    expect(stepQuantity(1, 1, 'slice')).toBe(1.25)
    expect(stepQuantity(1, -1, 'slice')).toBe(0.75)
  })

  it('snaps to the step grid so odd values land on a tidy number', () => {
    expect(stepQuantity(1 / 3, 1, 'slice')).toBe(0.5)
    expect(stepQuantity(1 / 3, -1, 'slice')).toBe(0.25)
    expect(stepQuantity(100.5, 1, 'g')).toBe(101)
    expect(stepQuantity(100.5, -1, 'g')).toBe(100)
  })

  it('starts from 0 when there is no value', () => {
    expect(stepQuantity(null, 1, 'g')).toBe(1)
    expect(stepQuantity(null, 1, 'slice')).toBe(0.25)
  })

  it('never returns zero or below', () => {
    expect(stepQuantity(1, -1, 'g')).toBeNull()
    expect(stepQuantity(0.25, -1, 'slice')).toBeNull()
    expect(stepQuantity(null, -1, 'g')).toBeNull()
  })

  it('has no float noise', () => {
    expect(stepQuantity(0.3, 1, 'ml')).toBe(1)
    expect(stepQuantity(2.75, 1, 'slice')).toBe(3)
  })
})
