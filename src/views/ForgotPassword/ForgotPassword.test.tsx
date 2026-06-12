import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ForgotPassword from './ForgotPassword'

function successResponse() {
  return Promise.resolve(new Response(JSON.stringify({ type: 'success' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }))
}

function oauthResponse(providers: string[]) {
  return Promise.resolve(new Response(JSON.stringify({ type: 'oauth', providers }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }))
}

function errorResponse(message = 'Something went wrong') {
  return Promise.resolve(new Response(JSON.stringify({ error: message }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetch).mockImplementation(successResponse)
})

describe('ForgotPassword', () => {
  describe('rendering', () => {
    it('renders the heading and helper text', () => {
      render(<ForgotPassword />)
      expect(screen.getByText('Forgot Your Password?')).toBeInTheDocument()
      expect(screen.getByText(/send you a link/i)).toBeInTheDocument()
    })

    it('renders the email input', () => {
      render(<ForgotPassword />)
      expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    })

    it('renders the Send Reset Link button', () => {
      render(<ForgotPassword />)
      expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
    })

    it('renders a Back to Login link', () => {
      render(<ForgotPassword />)
      const link = screen.getByRole('link', { name: /back to login/i })
      expect(link).toHaveAttribute('href', '/login')
    })
  })

  describe('form validation', () => {
    it('disables the submit button when email is empty', () => {
      render(<ForgotPassword />)
      expect(screen.getByRole('button', { name: /send reset link/i })).toBeDisabled()
    })

    it('disables the submit button when email is invalid', async () => {
      const user = userEvent.setup()
      render(<ForgotPassword />)
      await user.type(screen.getByPlaceholderText('you@example.com'), 'not-an-email')
      expect(screen.getByRole('button', { name: /send reset link/i })).toBeDisabled()
    })

    it('enables the submit button when a valid email is entered', async () => {
      const user = userEvent.setup()
      render(<ForgotPassword />)
      await user.type(screen.getByPlaceholderText('you@example.com'), 'user@example.com')
      expect(screen.getByRole('button', { name: /send reset link/i })).not.toBeDisabled()
    })
  })

  describe('success state', () => {
    it('shows check your email message after submission', async () => {
      const user = userEvent.setup()
      render(<ForgotPassword />)

      await user.type(screen.getByPlaceholderText('you@example.com'), 'user@example.com')
      await user.click(screen.getByRole('button', { name: /send reset link/i }))

      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument()
      })
    })

    it('hides the form after submission', async () => {
      const user = userEvent.setup()
      render(<ForgotPassword />)

      await user.type(screen.getByPlaceholderText('you@example.com'), 'user@example.com')
      await user.click(screen.getByRole('button', { name: /send reset link/i }))

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /send reset link/i })).not.toBeInTheDocument()
      })
    })

    it('sends request to the correct endpoint', async () => {
      const user = userEvent.setup()
      render(<ForgotPassword />)

      await user.type(screen.getByPlaceholderText('you@example.com'), 'user@example.com')
      await user.click(screen.getByRole('button', { name: /send reset link/i }))

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/auth/forgot-password',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ email: 'user@example.com' }),
          }),
        )
      })
    })

    it('shows Sending… on the button while loading', async () => {
      let resolve!: (v: Response) => void
      vi.mocked(fetch).mockImplementationOnce(() => new Promise(r => { resolve = r }))

      const user = userEvent.setup()
      render(<ForgotPassword />)

      await user.type(screen.getByPlaceholderText('you@example.com'), 'user@example.com')
      await user.click(screen.getByRole('button', { name: /send reset link/i }))

      expect(screen.getByRole('button', { name: /sending/i })).toBeInTheDocument()

      resolve(new Response(JSON.stringify({ type: 'success' }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    })
  })

  describe('OAuth user state', () => {
    it('shows the provider name when the account uses Google sign-in', async () => {
      vi.mocked(fetch).mockImplementationOnce(() => oauthResponse(['google']))

      const user = userEvent.setup()
      render(<ForgotPassword />)

      await user.type(screen.getByPlaceholderText('you@example.com'), 'oauth@example.com')
      await user.click(screen.getByRole('button', { name: /send reset link/i }))

      await waitFor(() => {
        expect(screen.getByText(/No password on this account/i)).toBeInTheDocument()
        expect(screen.getByText(/Google/)).toBeInTheDocument()
      })
    })

    it('shows Apple when the account uses Apple sign-in', async () => {
      vi.mocked(fetch).mockImplementationOnce(() => oauthResponse(['apple']))

      const user = userEvent.setup()
      render(<ForgotPassword />)

      await user.type(screen.getByPlaceholderText('you@example.com'), 'apple@example.com')
      await user.click(screen.getByRole('button', { name: /send reset link/i }))

      await waitFor(() => {
        expect(screen.getByText(/Apple/)).toBeInTheDocument()
      })
    })

    it('hides the email form when showing OAuth feedback', async () => {
      vi.mocked(fetch).mockImplementationOnce(() => oauthResponse(['google']))

      const user = userEvent.setup()
      render(<ForgotPassword />)

      await user.type(screen.getByPlaceholderText('you@example.com'), 'oauth@example.com')
      await user.click(screen.getByRole('button', { name: /send reset link/i }))

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('you@example.com')).not.toBeInTheDocument()
      })
    })
  })

  describe('error state', () => {
    it('shows an error message when the request fails', async () => {
      vi.mocked(fetch).mockImplementationOnce(() => errorResponse('Something went wrong'))

      const user = userEvent.setup()
      render(<ForgotPassword />)

      await user.type(screen.getByPlaceholderText('you@example.com'), 'user@example.com')
      await user.click(screen.getByRole('button', { name: /send reset link/i }))

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      })
    })

    it('keeps the form visible so the user can try again', async () => {
      vi.mocked(fetch).mockImplementationOnce(() => errorResponse())

      const user = userEvent.setup()
      render(<ForgotPassword />)

      await user.type(screen.getByPlaceholderText('you@example.com'), 'user@example.com')
      await user.click(screen.getByRole('button', { name: /send reset link/i }))

      await waitFor(() => {
        expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
      })
    })
  })
})
