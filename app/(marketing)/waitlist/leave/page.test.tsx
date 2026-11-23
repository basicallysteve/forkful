import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockLeave = vi.fn()
const mockVerify = vi.fn()
vi.mock('@/lib/waitlist', () => ({
  leaveWaitlist: (...a: unknown[]) => mockLeave(...a),
  verifyWaitlistLeaveToken: (...a: unknown[]) => mockVerify(...a),
}))

import WaitlistLeavePage from './page'

beforeEach(() => {
  mockLeave.mockReset()
  mockVerify.mockReset()
})

async function renderPage(token?: string) {
  const ui = await WaitlistLeavePage({ searchParams: Promise.resolve(token === undefined ? {} : { token }) })
  render(ui)
}

describe('GET /waitlist/leave', () => {
  it('shows a confirmation button for a valid token and does NOT delete', async () => {
    mockVerify.mockReturnValue('sam@example.com')
    await renderPage('good-token')
    expect(screen.getByRole('button', { name: 'Remove me from the waitlist' })).toBeInTheDocument()
    expect(screen.queryByText("You've been removed from the waitlist")).not.toBeInTheDocument()
    expect(mockLeave).not.toHaveBeenCalled()
  })

  it('shows "This link is invalid" for a tampered token and deletes nothing', async () => {
    mockVerify.mockReturnValue(null)
    await renderPage('bad-token')
    expect(screen.getByText('This link is invalid')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove me from the waitlist' })).not.toBeInTheDocument()
    expect(mockLeave).not.toHaveBeenCalled()
  })

  it('shows "This link is invalid" when the token is missing', async () => {
    await renderPage()
    expect(screen.getByText('This link is invalid')).toBeInTheDocument()
    expect(mockLeave).not.toHaveBeenCalled()
  })
})
