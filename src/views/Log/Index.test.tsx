import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Log from './Index'
import { UnauthorizedError } from '@/lib/api/errors'
import { resetFoodLogStore } from '@/stores/foodLog'

const { apiFetchDailyLog } = vi.hoisted(() => ({ apiFetchDailyLog: vi.fn() }))
vi.mock('@/lib/api/foodLog', () => ({ apiFetchDailyLog, apiCreateFoodLogEntry: vi.fn() }))
vi.mock('@/lib/api/foods', () => ({ apiFetchFoods: vi.fn().mockResolvedValue([]) }))
vi.mock('@/hooks/useMediaQuery', () => ({ useIsMobile: () => false }))

describe('Log view load failures', () => {
  beforeEach(() => {
    resetFoodLogStore()
    apiFetchDailyLog.mockReset()
  })

  it('shows a sign-in prompt, not "Could not load", on a 401', async () => {
    apiFetchDailyLog.mockRejectedValue(new UnauthorizedError())
    render(<Log />)
    const link = await screen.findByRole('link', { name: /sign in/i })
    expect(link.getAttribute('href')).toBe('/login')
    expect(screen.queryByText(/Could not load today/i)).toBeNull()
  })

  it('still shows the generic error for other failures', async () => {
    apiFetchDailyLog.mockRejectedValue(new Error('500'))
    render(<Log />)
    expect(await screen.findByText(/Could not load today/i)).toBeTruthy()
    expect(screen.queryByRole('link', { name: /sign in/i })).toBeNull()
  })
})
