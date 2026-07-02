import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
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

  it('fires once per shortId but again when the shortId changes', () => {
    const beacon = vi.fn(() => true)
    navigator.sendBeacon = beacon

    const { rerender } = render(<RecipeViewBeacon shortId="abc12345" />)
    // Re-render with the same shortId (reused instance) must not re-fire.
    rerender(<RecipeViewBeacon shortId="abc12345" />)
    expect(beacon).toHaveBeenCalledTimes(1)

    // Navigating to a different recipe on the same instance fires again.
    rerender(<RecipeViewBeacon shortId="def67890" />)
    expect(beacon).toHaveBeenCalledTimes(2)
    expect(beacon).toHaveBeenLastCalledWith('/api/recipes/def67890/view')

    cleanup()
  })
})
