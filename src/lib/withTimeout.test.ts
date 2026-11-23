import { describe, it, expect, vi, afterEach } from 'vitest'
import { withTimeout } from '@/lib/withTimeout'

afterEach(() => vi.useRealTimers())

describe('withTimeout', () => {
  it('resolves with the value when the promise settles first', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000)).resolves.toBe('ok')
  })

  it('passes through the rejection of the promise', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom')
  })

  it('rejects once the time limit passes on a promise that never settles', async () => {
    vi.useFakeTimers()
    const settled = withTimeout(new Promise<never>(() => {}), 10_000).then(() => 'resolved', (e: Error) => e.message)
    await vi.advanceTimersByTimeAsync(9_999)
    let early = true
    void settled.then(() => { early = false })
    await vi.advanceTimersByTimeAsync(0)
    expect(early).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    await expect(settled).resolves.toMatch(/timed out/i)
  })
})
