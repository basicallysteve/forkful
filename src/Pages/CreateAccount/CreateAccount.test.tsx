import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import CreateAccount from './CreateAccount'

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <BrowserRouter>
      {ui}
    </BrowserRouter>
  )
}

describe('CreateAccount Page', () => {
  describe('Form Rendering', () => {
    it('renders the account creation form with required fields', () => {
      renderWithProviders(<CreateAccount />)

      expect(screen.getByText('Create Your Account')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Choose a username')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Confirm your password')).toBeInTheDocument()
    })

    it('renders optional preference fields', () => {
      renderWithProviders(<CreateAccount />)

      expect(screen.getByText('Cuisine Preferences (Optional)')).toBeInTheDocument()
      expect(screen.getByText('Dietary Restrictions (Optional)')).toBeInTheDocument()
    })

    it('renders cuisine options as checkboxes', () => {
      renderWithProviders(<CreateAccount />)

      expect(screen.getByRole('checkbox', { name: /italian/i })).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /mexican/i })).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /asian/i })).toBeInTheDocument()
    })

    it('renders dietary options as radio buttons', () => {
      renderWithProviders(<CreateAccount />)

      expect(screen.getByRole('radio', { name: /vegetarian/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /vegan/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /gluten-free/i })).toBeInTheDocument()
    })
  })

  describe('Username Validation', () => {
    it('shows hint for username requirements', () => {
      renderWithProviders(<CreateAccount />)

      expect(screen.getByText('At least 3 characters.')).toBeInTheDocument()
    })
  })

  describe('Email Validation', () => {
    it('shows error for invalid email format', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      const emailInput = screen.getByPlaceholderText('you@example.com')
      await user.type(emailInput, 'invalid-email')

      expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid email address.')
      expect(emailInput).toHaveAttribute('aria-invalid', 'true')
    })

    it('does not show error for valid email format', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      const emailInput = screen.getByPlaceholderText('you@example.com')
      await user.type(emailInput, 'valid@email.com')

      expect(screen.queryByText('Please enter a valid email address.')).not.toBeInTheDocument()
      expect(emailInput).toHaveAttribute('aria-invalid', 'false')
    })
  })

  describe('Password Validation', () => {
    it('displays all password requirements', () => {
      renderWithProviders(<CreateAccount />)

      expect(screen.getByText('✓ At least 8 characters')).toBeInTheDocument()
      expect(screen.getByText('✓ One uppercase letter')).toBeInTheDocument()
      expect(screen.getByText('✓ One lowercase letter')).toBeInTheDocument()
      expect(screen.getByText('✓ One number')).toBeInTheDocument()
      expect(screen.getByText('✓ One special character')).toBeInTheDocument()
    })

    it('shows requirements as valid when password meets criteria', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      const passwordInput = screen.getByPlaceholderText('Create a strong password')
      await user.type(passwordInput, 'StrongPass1!')

      const requirements = screen.getAllByText(/✓/)
      requirements.forEach((req) => {
        expect(req).toHaveClass('valid')
      })
    })

    it('validates minimum length requirement', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      const passwordInput = screen.getByPlaceholderText('Create a strong password')
      await user.type(passwordInput, 'Short1!')

      const lengthRequirement = screen.getByText('✓ At least 8 characters')
      expect(lengthRequirement).not.toHaveClass('valid')
    })

    it('validates uppercase requirement', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      const passwordInput = screen.getByPlaceholderText('Create a strong password')
      await user.type(passwordInput, 'lowercase1!')

      const uppercaseRequirement = screen.getByText('✓ One uppercase letter')
      expect(uppercaseRequirement).not.toHaveClass('valid')
    })

    it('validates number requirement', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      const passwordInput = screen.getByPlaceholderText('Create a strong password')
      await user.type(passwordInput, 'NoNumbers!')

      const numberRequirement = screen.getByText('✓ One number')
      expect(numberRequirement).not.toHaveClass('valid')
    })

    it('validates special character requirement', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      const passwordInput = screen.getByPlaceholderText('Create a strong password')
      await user.type(passwordInput, 'NoSpecial1')

      const specialRequirement = screen.getByText('✓ One special character')
      expect(specialRequirement).not.toHaveClass('valid')
    })
  })

  describe('Password Confirmation', () => {
    it('shows error when passwords do not match', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      const passwordInput = screen.getByPlaceholderText('Create a strong password')
      const confirmInput = screen.getByPlaceholderText('Confirm your password')

      await user.type(passwordInput, 'StrongPass1!')
      await user.type(confirmInput, 'DifferentPass1!')

      expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.')
      expect(confirmInput).toHaveAttribute('aria-invalid', 'true')
    })

    it('does not show error when passwords match', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      const passwordInput = screen.getByPlaceholderText('Create a strong password')
      const confirmInput = screen.getByPlaceholderText('Confirm your password')

      await user.type(passwordInput, 'StrongPass1!')
      await user.type(confirmInput, 'StrongPass1!')

      expect(screen.queryByText('Passwords do not match.')).not.toBeInTheDocument()
      expect(confirmInput).toHaveAttribute('aria-invalid', 'false')
    })
  })

  describe('Form Submission', () => {
    it('disables submit button when form is incomplete', () => {
      renderWithProviders(<CreateAccount />)

      const submitButton = screen.getByRole('button', { name: /create account/i })
      expect(submitButton).toBeDisabled()
    })

    it('enables submit button when all required fields are valid', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      // Fill all required fields
      await user.type(screen.getByPlaceholderText('Choose a username'), 'testuser')
      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com')
      await user.type(screen.getByPlaceholderText('Create a strong password'), 'StrongPass1!')
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'StrongPass1!')

      const submitButton = screen.getByRole('button', { name: /create account/i })
      expect(submitButton).not.toBeDisabled()
    })

    it('shows success message after successful submission', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      // Fill all required fields
      await user.type(screen.getByPlaceholderText('Choose a username'), 'testuser')
      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com')
      await user.type(screen.getByPlaceholderText('Create a strong password'), 'StrongPass1!')
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'StrongPass1!')

      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Welcome to Forkful! 🎉')).toBeInTheDocument()
        expect(screen.getByText('Your account has been created successfully.')).toBeInTheDocument()
      })
    })

    it('does not submit when username is too short', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      await user.type(screen.getByPlaceholderText('Choose a username'), 'ab')
      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com')
      await user.type(screen.getByPlaceholderText('Create a strong password'), 'StrongPass1!')
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'StrongPass1!')

      const submitButton = screen.getByRole('button', { name: /create account/i })
      expect(submitButton).toBeDisabled()
    })

    it('does not allow weak password submission', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      // Fill all fields but use a weak password
      await user.type(screen.getByPlaceholderText('Choose a username'), 'testuser')
      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com')
      await user.type(screen.getByPlaceholderText('Create a strong password'), 'weak')
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'weak')

      const submitButton = screen.getByRole('button', { name: /create account/i })
      expect(submitButton).toBeDisabled()
    })

    it('does not allow password without uppercase letter', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      await user.type(screen.getByPlaceholderText('Choose a username'), 'testuser')
      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com')
      await user.type(screen.getByPlaceholderText('Create a strong password'), 'lowercase1!')
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'lowercase1!')

      const submitButton = screen.getByRole('button', { name: /create account/i })
      expect(submitButton).toBeDisabled()
    })

    it('does not allow password without number', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      await user.type(screen.getByPlaceholderText('Choose a username'), 'testuser')
      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com')
      await user.type(screen.getByPlaceholderText('Create a strong password'), 'NoNumbers!')
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'NoNumbers!')

      const submitButton = screen.getByRole('button', { name: /create account/i })
      expect(submitButton).toBeDisabled()
    })

    it('does not allow password without special character', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      await user.type(screen.getByPlaceholderText('Choose a username'), 'testuser')
      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com')
      await user.type(screen.getByPlaceholderText('Create a strong password'), 'NoSpecial1')
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'NoSpecial1')

      const submitButton = screen.getByRole('button', { name: /create account/i })
      expect(submitButton).toBeDisabled()
    })
  })

  describe('Optional Preferences', () => {
    it('allows selecting multiple cuisine preferences', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      const italianCheckbox = screen.getByRole('checkbox', { name: /italian/i })
      const mexicanCheckbox = screen.getByRole('checkbox', { name: /mexican/i })

      await user.click(italianCheckbox)
      await user.click(mexicanCheckbox)

      expect(italianCheckbox).toBeChecked()
      expect(mexicanCheckbox).toBeChecked()
    })

    it('allows deselecting cuisine preferences', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      const italianCheckbox = screen.getByRole('checkbox', { name: /italian/i })

      await user.click(italianCheckbox)
      expect(italianCheckbox).toBeChecked()

      await user.click(italianCheckbox)
      expect(italianCheckbox).not.toBeChecked()
    })

    it('allows selecting one dietary restriction', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      const vegetarianRadio = screen.getByRole('radio', { name: /vegetarian/i })
      await user.click(vegetarianRadio)

      expect(vegetarianRadio).toBeChecked()
    })

    it('only allows one dietary restriction at a time', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      const vegetarianRadio = screen.getByRole('radio', { name: /vegetarian/i })
      const veganRadio = screen.getByRole('radio', { name: /vegan/i })

      await user.click(vegetarianRadio)
      expect(vegetarianRadio).toBeChecked()

      await user.click(veganRadio)
      expect(veganRadio).toBeChecked()
      expect(vegetarianRadio).not.toBeChecked()
    })
  })

  describe('Navigation', () => {
    it('renders cancel button linking to home', () => {
      renderWithProviders(<CreateAccount />)

      const cancelButton = screen.getByRole('link', { name: /cancel/i })
      expect(cancelButton).toHaveAttribute('href', '/')
    })

    it('shows go to home link after successful account creation', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      await user.type(screen.getByPlaceholderText('Choose a username'), 'testuser')
      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com')
      await user.type(screen.getByPlaceholderText('Create a strong password'), 'StrongPass1!')
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'StrongPass1!')

      await user.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        const homeLink = screen.getByRole('link', { name: /go to home/i })
        expect(homeLink).toHaveAttribute('href', '/')
      })
    })
  })
})
