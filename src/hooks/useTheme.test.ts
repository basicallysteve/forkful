import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from '@/hooks/useTheme'

function addThemeColorMetas() {
  for (const media of ['(prefers-color-scheme: light)', '(prefers-color-scheme: dark)']) {
    const m = document.createElement('meta')
    m.name = 'theme-color'
    m.media = media
    m.content = '#000000'
    document.head.appendChild(m)
  }
}

const colors = () =>
  Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')).map((m) => m.content)

describe('useTheme theme-color sync (#252)', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
    localStorage.clear()
    delete document.documentElement.dataset.theme
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove())
    addThemeColorMetas()
  })

  it('sets every theme-color meta to the light toolbar colour when light is chosen', () => {
    localStorage.setItem('theme', 'light')
    renderHook(() => useTheme())
    expect(colors()).toEqual(['#ffffff', '#ffffff'])
  })

  it('sets every theme-color meta to the dark toolbar colour when dark is chosen', () => {
    localStorage.setItem('theme', 'dark')
    renderHook(() => useTheme())
    expect(colors()).toEqual(['#0c2b20', '#0c2b20'])
  })

  it('follows the manual toggle', () => {
    localStorage.setItem('theme', 'light')
    const { result } = renderHook(() => useTheme())
    act(() => result.current.toggleTheme())
    expect(colors()).toEqual(['#0c2b20', '#0c2b20'])
  })
})
