import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WaitlistLeaveConfirm from './WaitlistLeaveConfirm'

function res(status: number, body: object) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
}

beforeEach(() => {
  vi.mocked(fetch).mockReset()
})

describe('WaitlistLeaveConfirm', () => {
  it('removes nothing until the button is pressed', () => {
    render(<WaitlistLeaveConfirm token="tok" />)
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Remove me from the waitlist' })).toBeInTheDocument()
  })

  it('POSTs the token and then confirms the removal', async () => {
    vi.mocked(fetch).mockImplementation(() => res(200, { ok: true }))
    const user = userEvent.setup()
    render(<WaitlistLeaveConfirm token="tok" />)
    await user.click(screen.getByRole('button', { name: 'Remove me from the waitlist' }))
    expect(await screen.findByText("You've been removed from the waitlist")).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/waitlist/leave', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ token: 'tok' }),
    }))
  })

  it('moves focus to the confirmation heading after a successful removal', async () => {
    vi.mocked(fetch).mockImplementation(() => res(200, { ok: true }))
    const user = userEvent.setup()
    render(<WaitlistLeaveConfirm token="tok" />)
    await user.click(screen.getByRole('button', { name: 'Remove me from the waitlist' }))
    const heading = await screen.findByRole('heading', { name: "You've been removed from the waitlist" })
    expect(heading).toHaveFocus()
  })

  it('shows "This link is invalid" when the server rejects the token', async () => {
    vi.mocked(fetch).mockImplementation(() => res(400, { error: 'This link is invalid' }))
    const user = userEvent.setup()
    render(<WaitlistLeaveConfirm token="tok" />)
    await user.click(screen.getByRole('button', { name: 'Remove me from the waitlist' }))
    expect(await screen.findByText('This link is invalid')).toBeInTheDocument()
  })

  it('shows an error and keeps the button when the request fails', async () => {
    vi.mocked(fetch).mockImplementation(() => Promise.reject(new Error('offline')))
    const user = userEvent.setup()
    render(<WaitlistLeaveConfirm token="tok" />)
    await user.click(screen.getByRole('button', { name: 'Remove me from the waitlist' }))
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove me from the waitlist' })).toBeInTheDocument()
  })
})
