import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Login from './Login'

vi.mock('next-auth/react', () => ({
  signIn: vi.fn().mockResolvedValue({ error: null, code: undefined, ok: true, url: '/' }),
}))

function renderWithProviders(ui: React.ReactElement) {
  return render(ui)
}

describe('Login Page', () => {
  describe('Form Rendering', () => {
    it('renders the login form with required fields', () => {
      renderWithProviders(<Login />)

      expect(screen.getByText('Login to Your Account')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter your username')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument()
    })

    it('displays welcome back message', () => {
      renderWithProviders(<Login />)

      expect(screen.getByText('Welcome Back')).toBeInTheDocument()
      expect(screen.getByText('Access your saved recipes and meal plans.')).toBeInTheDocument()
    })

    it('renders login button', () => {
      renderWithProviders(<Login />)

      expect(screen.getByRole('button', { name: /^login$/i })).toBeInTheDocument()
    })

    it('renders create account link', () => {
      renderWithProviders(<Login />)

      expect(screen.getByText("Don't have an account?")).toBeInTheDocument()
      const createAccountLink = screen.getByRole('link', { name: /create account/i })
      expect(createAccountLink).toBeInTheDocument()
      expect(createAccountLink).toHaveAttribute('href', '/create-account')
    })

    it('renders forgot password link', () => {
      renderWithProviders(<Login />)

      const forgotPasswordLink = screen.getByRole('link', { name: /forgot password/i })
      expect(forgotPasswordLink).toBeInTheDocument()
      expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password')
    })
  })

  describe('Form Validation', () => {
    it('disables login button when form is empty', () => {
      renderWithProviders(<Login />)

      const loginButton = screen.getByRole('button', { name: /^login$/i })
      expect(loginButton).toBeDisabled()
    })

    it('disables login button when username is empty', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Login />)

      const passwordInput = screen.getByPlaceholderText('Enter your password')
      await user.type(passwordInput, 'password123')

      const loginButton = screen.getByRole('button', { name: /^login$/i })
      expect(loginButton).toBeDisabled()
    })

    it('disables login button when password is empty', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Login />)

      const usernameInput = screen.getByPlaceholderText('Enter your username')
      await user.type(usernameInput, 'testuser')

      const loginButton = screen.getByRole('button', { name: /^login$/i })
      expect(loginButton).toBeDisabled()
    })

    it('enables login button when both fields are filled', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Login />)

      await user.type(screen.getByPlaceholderText('Enter your username'), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter your password'), 'password123')

      const loginButton = screen.getByRole('button', { name: /^login$/i })
      expect(loginButton).not.toBeDisabled()
    })
  })

  describe('Input Fields', () => {
    it('accepts username input', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Login />)

      const usernameInput = screen.getByPlaceholderText('Enter your username')
      await user.type(usernameInput, 'testuser')

      expect(usernameInput).toHaveValue('testuser')
    })

    it('accepts email input', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Login />)

      const usernameInput = screen.getByPlaceholderText('Enter your username')
      await user.type(usernameInput, 'test@example.com')

      expect(usernameInput).toHaveValue('test@example.com')
    })

    it('accepts password input', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Login />)

      const passwordInput = screen.getByPlaceholderText('Enter your password')
      await user.type(passwordInput, 'mypassword')

      expect(passwordInput).toHaveValue('mypassword')
    })

    it('password field masks input', () => {
      renderWithProviders(<Login />)

      const passwordInput = screen.getByPlaceholderText('Enter your password')
      expect(passwordInput).toHaveAttribute('type', 'password')
    })

    it('password field has toggle mask button', () => {
      renderWithProviders(<Login />)

      const toggleButton = screen.getByRole('switch', { name: /show password/i })
      expect(toggleButton).toBeInTheDocument()
    })

    it('toggle mask button reveals and hides password', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Login />)

      const passwordInput = screen.getByPlaceholderText('Enter your password')
      expect(passwordInput).toHaveAttribute('type', 'password')

      const toggleButton = screen.getByRole('switch', { name: /show password/i })
      await user.click(toggleButton)

      expect(passwordInput).toHaveAttribute('type', 'text')

      await user.click(screen.getByRole('switch', { name: /hide password/i }))
      expect(passwordInput).toHaveAttribute('type', 'password')
    })

    it('username field has correct autocomplete attribute', () => {
      renderWithProviders(<Login />)

      const usernameInput = screen.getByPlaceholderText('Enter your username')
      expect(usernameInput).toHaveAttribute('autocomplete', 'username')
    })

    it('password field has correct autocomplete attribute', () => {
      renderWithProviders(<Login />)

      const passwordInput = screen.getByPlaceholderText('Enter your password')
      expect(passwordInput).toHaveAttribute('autocomplete', 'current-password')
    })
  })

  describe('Form Submission', () => {

    it('does not submit form when pressing login with empty fields', () => {
      renderWithProviders(<Login />)

      const loginButton = screen.getByRole('button', { name: /^login$/i })
      expect(loginButton).toBeDisabled()

      // Should not be able to click disabled button
      expect(screen.queryByText('Welcome back! 👋')).not.toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    beforeEach(() => {
      vi.mocked(signIn).mockResolvedValue({ error: null, code: undefined, ok: true, url: '/' })
    })

    it('renders cancel button linking to home', () => {
      renderWithProviders(<Login />)

      const cancelButton = screen.getByRole('link', { name: /cancel/i })
      expect(cancelButton).toHaveAttribute('href', '/')
    })

    it('redirects to home after successful login', async () => {
      const mockPush = vi.fn()
      vi.mocked(useRouter).mockReturnValue({ push: mockPush, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() })

      const user = userEvent.setup()
      renderWithProviders(<Login />)

      await user.type(screen.getByPlaceholderText('Enter your username'), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter your password'), 'password123')

      await user.click(screen.getByRole('button', { name: /^login$/i }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/')
      })
    })
  })

  describe('Account Deactivation', () => {
    const deactivatedResult = { code: 'ACCOUNT_DEACTIVATED', error: 'CredentialsSignin', ok: false, url: null }
    const successResult = { error: null, code: undefined, ok: true, url: '/' }

    beforeEach(() => {
      vi.mocked(signIn).mockResolvedValue(successResult)
    })

    async function triggerDeactivatedLogin() {
      vi.mocked(signIn).mockResolvedValueOnce(deactivatedResult)
      const user = userEvent.setup()
      renderWithProviders(<Login />)
      await user.type(screen.getByPlaceholderText('Enter your username'), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter your password'), 'mypassword')
      await user.click(screen.getByRole('button', { name: /^login$/i }))
      await waitFor(() => {
        expect(screen.getByText('Account Deactivated')).toBeInTheDocument()
      })
      return user
    }

    it('shows the reactivation prompt when sign-in returns ACCOUNT_DEACTIVATED', async () => {
      await triggerDeactivatedLogin()
      expect(screen.getByText(/Your account is currently deactivated/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /yes, reactivate my account/i })).toBeInTheDocument()
    })

    it('hides the login form when showing the reactivation prompt', async () => {
      await triggerDeactivatedLogin()
      expect(screen.queryByPlaceholderText('Enter your username')).not.toBeInTheDocument()
    })

    it('reactivates and redirects on confirmation', async () => {
      const mockPush = vi.fn()
      vi.mocked(useRouter).mockReturnValue({ push: mockPush, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() })
      vi.mocked(signIn).mockResolvedValueOnce(deactivatedResult).mockResolvedValueOnce(successResult)

      const user = await triggerDeactivatedLogin()
      await user.click(screen.getByRole('button', { name: /yes, reactivate my account/i }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/')
      })
    })

    it('returns to the login form when cancel is clicked', async () => {
      const user = await triggerDeactivatedLogin()
      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(screen.getByPlaceholderText('Enter your username')).toBeInTheDocument()
      expect(screen.queryByText('Account Deactivated')).not.toBeInTheDocument()
    })

    it('shows an error when the reactivation API call fails', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(
        JSON.stringify({ error: 'Too many attempts' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      ))

      const user = await triggerDeactivatedLogin()
      await user.click(screen.getByRole('button', { name: /yes, reactivate my account/i }))

      await waitFor(() => {
        expect(screen.getByText('Too many attempts')).toBeInTheDocument()
      })
    })
  })

  describe('Hints and Labels', () => {
    it('displays hint for username field', () => {
      renderWithProviders(<Login />)

      expect(screen.getByText('Enter your username.')).toBeInTheDocument()
    })

    it('displays hint for password field', () => {
      renderWithProviders(<Login />)

      expect(screen.getByText('Enter your password.')).toBeInTheDocument()
    })

    it('username field has proper aria-describedby', () => {
      renderWithProviders(<Login />)

      const usernameInput = screen.getByPlaceholderText('Enter your username')
      expect(usernameInput).toHaveAttribute('aria-describedby', 'username-hint')
    })

    it('password field has proper aria-describedby', () => {
      renderWithProviders(<Login />)

      const passwordInput = screen.getByPlaceholderText('Enter your password')
      expect(passwordInput).toHaveAttribute('aria-describedby', 'password-hint')
    })
  })
})
