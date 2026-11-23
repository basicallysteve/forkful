import { describe, expect, it, vi } from 'vitest'

vi.mock('@/auth', () => ({ auth: async () => null }))
vi.mock('./ClientLayout', () => ({ default: () => null }))

import { metadata } from './layout'

describe('root layout metadata', () => {
  it('sets a title template with a default', () => {
    expect(metadata.title).toEqual({ template: '%s | EatForkful', default: 'EatForkful' })
  })

  it('sets metadataBase from the site URL', () => {
    expect(metadata.metadataBase).toBeInstanceOf(URL)
  })
})
