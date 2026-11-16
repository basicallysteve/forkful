import { describe, it, expect, vi } from 'vitest'
import { apiFetchDailyLog, apiCreateFoodLogEntry } from './foodLog'
import { UnauthorizedError } from './errors'

describe('food log API 401 handling', () => {
  it('apiFetchDailyLog throws UnauthorizedError on 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 401 }))
    await expect(apiFetchDailyLog('2026-11-12')).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('apiFetchDailyLog still throws a plain error on 500', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }))
    const err = await apiFetchDailyLog('2026-11-12').catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err).not.toBeInstanceOf(UnauthorizedError)
  })

  it('apiCreateFoodLogEntry throws UnauthorizedError on 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 401 }))
    await expect(
      apiCreateFoodLogEntry({ foodId: 1, amount: 1, unit: 'g', logDate: '2026-11-12' }),
    ).rejects.toBeInstanceOf(UnauthorizedError)
  })
})
