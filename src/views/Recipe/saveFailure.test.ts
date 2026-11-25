import { describe, it, expect } from 'vitest'
import { SAVE_FAILURE_LIFE_MS } from './saveFailure'

describe('save failure toast lifetime (#288)', () => {
  it('auto-dismisses after 4 seconds', () => {
    expect(SAVE_FAILURE_LIFE_MS).toBe(4000)
  })
})
