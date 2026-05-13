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
  window.addEventListener(THEME_CHANGE_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // Sync DOM attribute whenever theme changes (updating external system from state — allowed in effects)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(STORAGE_KEY, next)
    document.documentElement.dataset.theme = next
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }

  return { theme, toggleTheme }
}
