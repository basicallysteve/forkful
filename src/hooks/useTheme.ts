'use client'

import { useEffect, useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const THEME_CHANGE_EVENT = 'themechange'

function getSnapshot(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    return stored ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  } catch {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
}

function getServerSnapshot(): Theme {
  return 'light'
}

function subscribe(callback: () => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', callback)
  window.addEventListener(THEME_CHANGE_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    mq.removeEventListener('change', callback)
    window.removeEventListener(THEME_CHANGE_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // Syncs data-theme after each render. toggleTheme sets it immediately for
  // instant response, but this effect handles the "clear stored pref" case
  // (when the user clears localStorage externally) and the initial mount.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        document.documentElement.dataset.theme = stored
      } else {
        delete document.documentElement.dataset.theme
      }
    } catch { /* localStorage unavailable — CSS media query handles theming */ }
  }, [theme])

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(STORAGE_KEY, next)
    document.documentElement.dataset.theme = next
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }

  return { theme, toggleTheme }
}
