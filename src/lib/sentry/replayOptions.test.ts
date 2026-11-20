import { describe, it, expect } from 'vitest'
import { replayOptions } from './replayOptions'

describe('replayOptions', () => {
  it('masks all on-screen text, because food logs and pantry contents are personal', () => {
    expect(replayOptions.maskAllText).toBe(true)
  })

  it('masks all form input values', () => {
    expect(replayOptions.maskAllInputs).toBe(true)
  })

  it('blocks images and other media', () => {
    expect(replayOptions.blockAllMedia).toBe(true)
  })

  it('does not unmask or unblock anything by default', () => {
    expect(replayOptions).not.toHaveProperty('unmask')
    expect(replayOptions).not.toHaveProperty('unblock')
  })
})
