import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import RecipeViewBeacon from './RecipeViewBeacon'

const originalSendBeacon = navigator.sendBeacon

afterEach(() => {
  navigator.sendBeacon = originalSendBeacon
  vi.restoreAllMocks()
})

describe('RecipeViewBeacon', () => {
  it('uses navigator.sendBeacon when available', () => {
    const beacon = vi.fn(() => true)
    navigator.sendBeacon = beacon
    render(<RecipeViewBeacon shortId="abc12345" />)
    expect(beacon).toHaveBeenCalledTimes(1)
    expect(beacon).toHaveBeenCalledWith('/api/recipes/abc12345/view')
  })

  it('falls back to a keepalive POST fetch when sendBeacon is unavailable', () => {
    // @ts-expect-error simulate an environment without sendBeacon
    navigator.sendBeacon = undefined
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    render(<RecipeViewBeacon shortId="xyz98765" />)
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/recipes/xyz98765/view',
      expect.objectContaining({ method: 'POST', keepalive: true }),
    )
  })
})
