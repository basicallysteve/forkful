import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSubmitGuard } from './useSubmitGuard'

describe('useSubmitGuard', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useSubmitGuard())
    expect(result.current.busy).toBeNull()
  })

  it('rejects a second tryStart synchronously, before React re-renders', () => {
    const { result } = renderHook(() => useSubmitGuard())
    let first = false
    let second = true
    act(() => {
      first = result.current.tryStart()
      second = result.current.tryStart()
    })
    expect(first).toBe(true)
    expect(second).toBe(false)
  })

  it('exposes the busy value in state after tryStart', () => {
    const { result } = renderHook(() => useSubmitGuard<'save' | 'publish'>())
    act(() => {
      result.current.tryStart('publish')
    })
    expect(result.current.busy).toBe('publish')
  })

  it('allows a new start after reset and clears the state', () => {
    const { result } = renderHook(() => useSubmitGuard())
    act(() => {
      result.current.tryStart()
    })
    act(() => {
      result.current.reset()
    })
    expect(result.current.busy).toBeNull()
    let again = false
    act(() => {
      again = result.current.tryStart()
    })
    expect(again).toBe(true)
  })
})
