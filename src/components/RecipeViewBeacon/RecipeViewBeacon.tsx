'use client'

import { useEffect, useRef } from 'react'

/**
 * Fires a best-effort Recipe View Count beacon once when a recipe detail page
 * mounts. Deliberately separate from the metering middleware (ADR-0020). Author
 * exclusion happens server-side; the session cookie rides along with sendBeacon.
 */
export default function RecipeViewBeacon({ shortId }: { shortId: string }) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true

    const url = `/api/recipes/${shortId}/view`
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(url)
    } else {
      fetch(url, { method: 'POST', keepalive: true }).catch(() => {})
    }
  }, [shortId])

  return null
}
