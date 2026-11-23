import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockSession = vi.fn()
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})
vi.mock('@/lib/auth', () => ({ getSessionUser: () => mockSession() }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => mockRedirect(url) }))

import WaitlistPage, { metadata } from './page'

beforeEach(() => {
  mockSession.mockReset()
  mockRedirect.mockClear()
})

describe('/waitlist page', () => {
  it('renders the join form for a logged-out visitor', async () => {
    mockSession.mockResolvedValue(null)
    render(await WaitlistPage())
    expect(screen.getByRole('heading', { name: /waitlist/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('redirects a logged-in user to the home page', async () => {
    mockSession.mockResolvedValue({ userId: 1, username: 'sam' })
    await expect(WaitlistPage()).rejects.toThrow('NEXT_REDIRECT:/')
    expect(mockRedirect).toHaveBeenCalledWith('/')
  })

  it('has a title', () => {
    expect(metadata.title).toBeTruthy()
  })
})
