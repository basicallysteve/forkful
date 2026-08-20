'use client'

import { useSyncExternalStore } from 'react'

// Reactively tracks a CSS media query. SSR/first paint reports `false` (desktop-first) so hydration
// matches the server, then corrects on mount. Mirrors the useSyncExternalStore pattern in useTheme.
export function useMediaQuery(query: string): boolean {
  function subscribe(callback: () => void): () => void {
    const mq = window.matchMedia(query)
    mq.addEventListener('change', callback)
    return () => mq.removeEventListener('change', callback)
  }
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

// The app's mobile breakpoint, matching the 640px cutoff used across the SCSS media queries.
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 640px)')
}
