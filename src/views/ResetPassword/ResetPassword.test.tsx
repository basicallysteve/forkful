import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSearchParams } from 'next/navigation'
import ResetPassword from './ResetPassword'

const mockUpdate = vi.fn()

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: null, status: 'unauthenticated', update: mockUpdate })),
}))

const STRONG_PASSWORD = 'Str0ng!Pass'

function tokenSearchParams(token: string) {
  return new URLSearchParams(`token=${token}`)
}

function noTokenSearchParams() {
  return new URLSearchParams()
}

function successResponse(extra?: Record<string, unknown>) {
  return Promise.resolve(new Response(JSON.stringify({ type: 'success', ...extra }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }))
}

function errorResponse(message = 'Something went wrong') {
  return Promise.resolve(new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useSearchParams).mockReturnValue(noTokenSearchParams() as ReturnType<typeof useSearchParams>)
  vi.mocked(fetch).mockImplementation(() => successResponse({ passwordChangedAt: new Date().toISOString() }))
})

describe('ResetPassword', () => {
  describe('forced mode (no token in URL)', () => {
    it('shows the forced reset heading', () => {
      render(<ResetPassword />)
      expect(screen.getByText('Password Reset Required')).toBeInTheDocument()
    })

    it('shows the 90-day explanation', () => {
      render(<ResetPassword />)
      expect(screen.getByText(/90 days old/i)).toBeInTheDocument()
    })

    it('does not show a Cancel link', () => {
      render(<ResetPassword />)
      expect(screen.queryByRole('link', { name: /cancel/i })).not.toBeInTheDocument()
    })
  })

  describe('token mode (token in URL)', () => {
    beforeEach(() => {
      vi.mocked(useSearchParams).mockReturnValue(
        tokenSearchParams('test-token-abc') as ReturnType<typeof useSearchParams>,
      )
    })

    it('shows the token mode heading', () => {
      render(<ResetPassword />)
      expect(screen.getByText('Set a New Password')).toBeInTheDocument()
    })

    it('shows a Cancel link back to login', () => {
      render(<ResetPassword />)
      const cancel = screen.getByRole('link', { name: /cancel/i })
      expect(cancel).toHaveAttribute('href', '/login')
    })
  })

  describe('form rendering', () => {
    it('renders new password and confirm password fields', () => {
      render(<ResetPassword />)
      expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Confirm your new password')).toBeInTheDocument()
    })

    it('renders the Set New Password button', () => {
      render(<ResetPassword />)
      expect(screen.getByRole('button', { name: /set new password/i })).toBeInTheDocument()
    })

    it('shows all six password requirements', () => {
      render(<ResetPassword />)
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
      expect(screen.getByText(/one uppercase letter/i)).toBeInTheDocument()
      expect(screen.getByText(/one lowercase letter/i)).toBeInTheDocument()
      expect(screen.getByText(/one number/i)).toBeInTheDocument()
      expect(screen.getByText(/one special character/i)).toBeInTheDocument()
      expect(screen.getByText(/not a common password/i)).toBeInTheDocument()
    })
  })

  describe('form validation', () => {
    it('disables submit when passwords are empty', () => {
      render(<ResetPassword />)
      expect(screen.getByRole('button', { name: /set new password/i })).toBeDisabled()
    })

    it('disables submit when new password does not meet requirements', async () => {
      const user = userEvent.setup()
      render(<ResetPassword />)

      await user.type(screen.getByPlaceholderText('Create a strong password'), 'weak')
      await user.type(screen.getByPlaceholderText('Confirm your new password'), 'weak')

      expect(screen.getByRole('button', { name: /set new password/i })).toBeDisabled()
    })

    it('disables submit when passwords do not match', async () => {
      const user = userEvent.setup()
      render(<ResetPassword />)

      await user.type(screen.getByPlaceholderText('Create a strong password'), STRONG_PASSWORD)
      await user.type(screen.getByPlaceholderText('Confirm your new password'), 'Different1!')

      expect(screen.getByRole('button', { name: /set new password/i })).toBeDisabled()
    })

    it('enables submit when a valid password is entered and confirmed', async () => {
      const user = userEvent.setup()
      render(<ResetPassword />)

      await user.type(screen.getByPlaceholderText('Create a strong password'), STRONG_PASSWORD)
      await user.type(screen.getByPlaceholderText('Confirm your new password'), STRONG_PASSWORD)

      expect(screen.getByRole('button', { name: /set new password/i })).not.toBeDisabled()
    })

    it('shows passwords do not match error when confirm field differs', async () => {
      const user = userEvent.setup()
      render(<ResetPassword />)

      await user.type(screen.getByPlaceholderText('Create a strong password'), STRONG_PASSWORD)
      await user.type(screen.getByPlaceholderText('Confirm your new password'), 'Mismatch1!')

      expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
    })
  })

  describe('token mode submission', () => {
    beforeEach(() => {
      vi.mocked(useSearchParams).mockReturnValue(
        tokenSearchParams('reset-tok-123') as ReturnType<typeof useSearchParams>,
      )
      vi.mocked(fetch).mockImplementation(() => successResponse())
    })

    it('posts the token and new password to the API', async () => {
      const user = userEvent.setup()
      render(<ResetPassword />)

      await user.type(screen.getByPlaceholderText('Create a strong password'), STRONG_PASSWORD)
      await user.type(screen.getByPlaceholderText('Confirm your new password'), STRONG_PASSWORD)
      await user.click(screen.getByRole('button', { name: /set new password/i }))

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/auth/reset-password',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ token: 'reset-tok-123', newPassword: STRONG_PASSWORD }),
          }),
        )
      })
    })

    it('shows success state after a successful reset', async () => {
      const user = userEvent.setup()
      render(<ResetPassword />)

      await user.type(screen.getByPlaceholderText('Create a strong password'), STRONG_PASSWORD)
      await user.type(screen.getByPlaceholderText('Confirm your new password'), STRONG_PASSWORD)
      await user.click(screen.getByRole('button', { name: /set new password/i }))

      await waitFor(() => {
        expect(screen.getByText('Password updated')).toBeInTheDocument()
      })
    })

    it('shows a Go to Login link in the success state', async () => {
      const user = userEvent.setup()
      render(<ResetPassword />)

      await user.type(screen.getByPlaceholderText('Create a strong password'), STRONG_PASSWORD)
      await user.type(screen.getByPlaceholderText('Confirm your new password'), STRONG_PASSWORD)
      await user.click(screen.getByRole('button', { name: /set new password/i }))

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /go to login/i })).toHaveAttribute('href', '/login')
      })
    })
  })

  describe('forced mode submission', () => {
    it('posts without a token', async () => {
      vi.mocked(fetch).mockImplementation(() =>
        successResponse({ passwordChangedAt: new Date().toISOString() }),
      )

      const user = userEvent.setup()
      render(<ResetPassword />)

      await user.type(screen.getByPlaceholderText('Create a strong password'), STRONG_PASSWORD)
      await user.type(screen.getByPlaceholderText('Confirm your new password'), STRONG_PASSWORD)
      await user.click(screen.getByRole('button', { name: /set new password/i }))

      await waitFor(() => {
        const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
        expect(body.token).toBeUndefined()
        expect(body.newPassword).toBe(STRONG_PASSWORD)
      })
    })

    it('calls session update after a successful forced reset', async () => {
      vi.mocked(fetch).mockImplementation(() =>
        successResponse({ passwordChangedAt: '2026-06-11T00:00:00.000Z' }),
      )

      const user = userEvent.setup()
      render(<ResetPassword />)

      await user.type(screen.getByPlaceholderText('Create a strong password'), STRONG_PASSWORD)
      await user.type(screen.getByPlaceholderText('Confirm your new password'), STRONG_PASSWORD)
      await user.click(screen.getByRole('button', { name: /set new password/i }))

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith({ passwordChangedAt: '2026-06-11T00:00:00.000Z' })
      })
    })
  })

  describe('error handling', () => {
    it('shows the error message from the API', async () => {
      vi.mocked(fetch).mockImplementationOnce(() => errorResponse('This reset link has expired'))

      vi.mocked(useSearchParams).mockReturnValue(
        tokenSearchParams('old-tok') as ReturnType<typeof useSearchParams>,
      )

      const user = userEvent.setup()
      render(<ResetPassword />)

      await user.type(screen.getByPlaceholderText('Create a strong password'), STRONG_PASSWORD)
      await user.type(screen.getByPlaceholderText('Confirm your new password'), STRONG_PASSWORD)
      await user.click(screen.getByRole('button', { name: /set new password/i }))

      await waitFor(() => {
        expect(screen.getByText('This reset link has expired')).toBeInTheDocument()
      })
    })

    it('keeps the form visible after an error', async () => {
      vi.mocked(fetch).mockImplementationOnce(() => errorResponse())

      vi.mocked(useSearchParams).mockReturnValue(
        tokenSearchParams('bad-tok') as ReturnType<typeof useSearchParams>,
      )

      const user = userEvent.setup()
      render(<ResetPassword />)

      await user.type(screen.getByPlaceholderText('Create a strong password'), STRONG_PASSWORD)
      await user.type(screen.getByPlaceholderText('Confirm your new password'), STRONG_PASSWORD)
      await user.click(screen.getByRole('button', { name: /set new password/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /set new password/i })).toBeInTheDocument()
      })
    })
  })
})
