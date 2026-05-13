'use client'

import { useEffect, useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const THEME_CHANGE_EVENT = 'themechange'

function getSnapshot(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  return stored ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
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

  // Only set data-theme when the user has stored an explicit preference.
  // Without it, CSS @media (prefers-color-scheme) handles theming naturally,
  // and OS preference changes are reflected in real time.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      document.documentElement.dataset.theme = stored
    } else {
      delete document.documentElement.dataset.theme
    }
  }, [theme])

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(STORAGE_KEY, next)
    document.documentElement.dataset.theme = next
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }

  return { theme, toggleTheme }
}
