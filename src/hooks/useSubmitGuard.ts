import { useCallback, useRef, useState } from 'react'

/**
 * Blocks re-entry while an async submit is in flight.
 *
 * `tryStart()` reads a ref, so a second call in the same tick (double-click, before
 * React re-renders) is rejected synchronously. `busy` is state, so the UI can render
 * the disabled / "Saving…" button. The two are only ever changed together here.
 *
 * Call `reset()` on failure. On success leave it busy while the page navigates away.
 */
export function useSubmitGuard<T = true>() {
  const activeRef = useRef(false)
  const [busy, setBusy] = useState<T | null>(null)

  const tryStart = useCallback((value: T = true as T): boolean => {
    if (activeRef.current) return false
    activeRef.current = true
    setBusy(value)
    return true
  }, [])

  const reset = useCallback(() => {
    activeRef.current = false
    setBusy(null)
  }, [])

  return { busy, tryStart, reset }
}
