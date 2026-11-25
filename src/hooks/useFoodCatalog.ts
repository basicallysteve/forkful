import { useCallback, useEffect, useState } from 'react'
import { useFoodStore } from '@/stores/food'
import { apiFetchFoods } from '@/lib/api/foods'

export type FoodCatalogStatus = 'loading' | 'loaded' | 'error'

/**
 * Makes sure the shared food store holds the catalog, fetching it on mount when it is still empty
 * (ADR-0012: the screen loads its own data, it does not rely on another screen having hydrated the store).
 * A store that already has foods counts as loaded and is not refetched. Opt-in: only screens that call
 * this hook fetch.
 */
export function useFoodCatalog(): { status: FoodCatalogStatus; retry: () => void } {
  const setFoods = useFoodStore((state) => state.setFoods)
  const [status, setStatus] = useState<FoodCatalogStatus>(() =>
    useFoodStore.getState().foods.length > 0 ? 'loaded' : 'loading',
  )
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (attempt === 0 && useFoodStore.getState().foods.length > 0) return
    let cancelled = false
    apiFetchFoods()
      .then((foods) => {
        if (cancelled) return
        setFoods(foods)
        setStatus('loaded')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => { cancelled = true }
  }, [attempt, setFoods])

  const retry = useCallback(() => {
    setStatus('loading')
    setAttempt((n) => n + 1)
  }, [])
  return { status, retry }
}
