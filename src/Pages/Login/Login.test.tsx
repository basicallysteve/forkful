import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import Login from './Login'

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <BrowserRouter>
      {ui}
    </BrowserRouter>
  )
}

describe('Login Page', () => {
  describe('Form Rendering', () => {
    it('renders the login form with required fields', () => {
      renderWithProviders(<Login />)

      expect(screen.getByText('Login to Your Account')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter your username or email')).toBeInTheDocument()
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
  })

  describe('Form Validation', () => {
    it('disables login button when form is empty', () => {
      renderWithProviders(<Login />)

      const loginButton = screen.getByRole('button', { name: /^login$/i })
      expect(loginButton).toBeDisabled()
    })

    it('disables login button when username/email is empty', async () => {
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

      const usernameInput = screen.getByPlaceholderText('Enter your username or email')
      await user.type(usernameInput, 'testuser')

      const loginButton = screen.getByRole('button', { name: /^login$/i })
      expect(loginButton).toBeDisabled()
    })

    it('enables login button when both fields are filled', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Login />)

      await user.type(screen.getByPlaceholderText('Enter your username or email'), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter your password'), 'password123')

      const loginButton = screen.getByRole('button', { name: /^login$/i })
      expect(loginButton).not.toBeDisabled()
    })
  })

  describe('Input Fields', () => {
    it('accepts username input', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Login />)

      const usernameInput = screen.getByPlaceholderText('Enter your username or email')
      await user.type(usernameInput, 'testuser')

      expect(usernameInput).toHaveValue('testuser')
    })

    it('accepts email input', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Login />)

      const usernameInput = screen.getByPlaceholderText('Enter your username or email')
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

    it('username field has correct autocomplete attribute', () => {
      renderWithProviders(<Login />)

      const usernameInput = screen.getByPlaceholderText('Enter your username or email')
      expect(usernameInput).toHaveAttribute('autocomplete', 'username')
    })

    it('password field has correct autocomplete attribute', () => {
      renderWithProviders(<Login />)

      const passwordInput = screen.getByPlaceholderText('Enter your password')
      expect(passwordInput).toHaveAttribute('autocomplete', 'current-password')
    })
  })

  describe('Form Submission', () => {
    it('shows success message after successful login', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Login />)

      await user.type(screen.getByPlaceholderText('Enter your username or email'), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter your password'), 'password123')

      const loginButton = screen.getByRole('button', { name: /^login$/i })
      await user.click(loginButton)

      await waitFor(() => {
        expect(screen.getByText('Welcome back! 👋')).toBeInTheDocument()
        expect(screen.getByText('You have successfully logged in.')).toBeInTheDocument()
      })
    })

    it('does not submit form when pressing login with empty fields', () => {
      renderWithProviders(<Login />)

      const loginButton = screen.getByRole('button', { name: /^login$/i })
      expect(loginButton).toBeDisabled()

      // Should not be able to click disabled button
      expect(screen.queryByText('Welcome back! 👋')).not.toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    it('renders cancel button linking to home', () => {
      renderWithProviders(<Login />)

      const cancelButton = screen.getByRole('link', { name: /cancel/i })
      expect(cancelButton).toHaveAttribute('href', '/')
    })

    it('shows go to home link after successful login', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Login />)

      await user.type(screen.getByPlaceholderText('Enter your username or email'), 'testuser')
      await user.type(screen.getByPlaceholderText('Enter your password'), 'password123')

      await user.click(screen.getByRole('button', { name: /^login$/i }))

      await waitFor(() => {
        const homeLink = screen.getByRole('link', { name: /go to home/i })
        expect(homeLink).toHaveAttribute('href', '/')
      })
    })
  })

  describe('Hints and Labels', () => {
    it('displays hint for username field', () => {
      renderWithProviders(<Login />)

      expect(screen.getByText('Enter your username or email address.')).toBeInTheDocument()
    })

    it('displays hint for password field', () => {
      renderWithProviders(<Login />)

      expect(screen.getByText('Enter your password.')).toBeInTheDocument()
    })

    it('username field has proper aria-describedby', () => {
      renderWithProviders(<Login />)

      const usernameInput = screen.getByPlaceholderText('Enter your username or email')
      expect(usernameInput).toHaveAttribute('aria-describedby', 'username-hint')
    })

    it('password field has proper aria-describedby', () => {
      renderWithProviders(<Login />)

      const passwordInput = screen.getByPlaceholderText('Enter your password')
      expect(passwordInput).toHaveAttribute('aria-describedby', 'password-hint')
    })
  })
})
