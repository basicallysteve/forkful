import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WaitlistForm from './WaitlistForm'

function ok() {
  return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
}

beforeEach(() => {
  vi.mocked(fetch).mockReset()
  vi.mocked(fetch).mockImplementation(ok)
})

describe('WaitlistForm', () => {
  it('renders email, optional name and an unchecked opt-in', () => {
    render(<WaitlistForm />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('posts the email, name and opt-in then shows the confirmation', async () => {
    const user = userEvent.setup()
    render(<WaitlistForm />)
    await user.type(screen.getByLabelText(/email/i), 'sam@example.com')
    await user.type(screen.getByLabelText(/name/i), 'Sam')
    await user.click(screen.getByRole('button', { name: /join the waitlist/i }))

    await waitFor(() => {
      expect(screen.getByText("You're on the list. We'll email you when your invite is ready.")).toBeInTheDocument()
    })
    expect(fetch).toHaveBeenCalledWith('/api/waitlist', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'sam@example.com', name: 'Sam', marketingEmailOptIn: false }),
    }))
  })

  it('moves focus to the confirmation message after a successful submit', async () => {
    const user = userEvent.setup()
    render(<WaitlistForm />)
    await user.type(screen.getByLabelText(/email/i), 'sam@example.com')
    await user.click(screen.getByRole('button', { name: /join the waitlist/i }))
    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent("You're on the list.")
    expect(status).toHaveFocus()
  })

  it('sends opt-in true when the box is ticked', async () => {
    const user = userEvent.setup()
    render(<WaitlistForm />)
    await user.type(screen.getByLabelText(/email/i), 'sam@example.com')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /join the waitlist/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string).marketingEmailOptIn).toBe(true)
  })

  it('shows "Enter a valid email" for an invalid email and sends nothing', async () => {
    const user = userEvent.setup()
    render(<WaitlistForm />)
    await user.type(screen.getByLabelText(/email/i), 'sam@')
    await user.click(screen.getByRole('button', { name: /join the waitlist/i }))
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('shows "Enter a valid email" for an empty email and sends nothing', async () => {
    const user = userEvent.setup()
    render(<WaitlistForm />)
    await user.click(screen.getByRole('button', { name: /join the waitlist/i }))
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('shows the server validation message when the API rejects the email', async () => {
    vi.mocked(fetch).mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ error: 'Enter a valid email' }), { status: 400, headers: { 'Content-Type': 'application/json' } })))
    const user = userEvent.setup()
    render(<WaitlistForm />)
    await user.type(screen.getByLabelText(/email/i), 'sam@example.com')
    await user.click(screen.getByRole('button', { name: /join the waitlist/i }))
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument()
    expect(screen.queryByText(/you're on the list/i)).not.toBeInTheDocument()
  })

  it('shows a generic error when the request fails', async () => {
    vi.mocked(fetch).mockImplementation(() => Promise.reject(new Error('offline')))
    const user = userEvent.setup()
    render(<WaitlistForm />)
    await user.type(screen.getByLabelText(/email/i), 'sam@example.com')
    await user.click(screen.getByRole('button', { name: /join the waitlist/i }))
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument()
  })
})
