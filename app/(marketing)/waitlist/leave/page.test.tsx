import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockLeave = vi.fn()
vi.mock('@/lib/waitlist', () => ({ leaveWaitlist: (...a: unknown[]) => mockLeave(...a) }))

import WaitlistLeavePage from './page'

beforeEach(() => mockLeave.mockReset())

async function renderPage(token?: string) {
  const ui = await WaitlistLeavePage({ searchParams: Promise.resolve(token === undefined ? {} : { token }) })
  render(ui)
}

describe('/waitlist/leave', () => {
  it('removes the entry for a valid token and says so', async () => {
    mockLeave.mockResolvedValue('removed')
    await renderPage('good-token')
    expect(mockLeave).toHaveBeenCalledWith('good-token')
    expect(screen.getByText("You've been removed from the waitlist")).toBeInTheDocument()
  })

  it('shows "This link is invalid" for a tampered token', async () => {
    mockLeave.mockResolvedValue('invalid')
    await renderPage('bad-token')
    expect(screen.getByText('This link is invalid')).toBeInTheDocument()
  })

  it('shows "This link is invalid" without calling the lib when the token is missing', async () => {
    await renderPage()
    expect(mockLeave).not.toHaveBeenCalled()
    expect(screen.getByText('This link is invalid')).toBeInTheDocument()
  })
})
