'use client'

import { useEffect, useRef } from 'react'

/**
 * Fires a best-effort Recipe View Count beacon once per Recipe when a recipe
 * detail page mounts. Deliberately separate from the metering middleware
 * (ADR-0020). Author exclusion happens server-side; the session cookie rides
 * along with sendBeacon.
 *
 * The ref tracks the last `shortId` fired for — not a plain boolean — so a
 * client-side navigation that reuses this component instance for a *different*
 * Recipe still counts, while React StrictMode's double-invoke of the effect for
 * the *same* `shortId` fires only once.
 */
export default function RecipeViewBeacon({ shortId }: { shortId: string }) {
  const firedFor = useRef<string | null>(null)

  useEffect(() => {
    if (firedFor.current === shortId) return
    firedFor.current = shortId

    const url = `/api/recipes/${shortId}/view`
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(url)
    } else {
      fetch(url, { method: 'POST', keepalive: true }).catch(() => {})
    }
  }, [shortId])

  return null
}
