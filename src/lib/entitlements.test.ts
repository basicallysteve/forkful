import { describe, it, expect } from 'vitest'
import { hasUnlimitedRecipeAccess } from '@/lib/entitlements'

describe('hasUnlimitedRecipeAccess', () => {
  it('grants unlimited access to an authenticated viewer', () => {
    expect(hasUnlimitedRecipeAccess({ isAuthenticated: true })).toBe(true)
  })

  it('denies unlimited access to an Anonymous Visitor', () => {
    expect(hasUnlimitedRecipeAccess({ isAuthenticated: false })).toBe(false)
  })
})
