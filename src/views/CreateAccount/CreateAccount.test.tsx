import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import CreateAccount from './CreateAccount'

vi.mock('@/lib/api/users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/users')>()),
  apiSignUp: vi.fn(),
}))

import { apiSignUp, InviteInvalidError } from '@/lib/api/users'

const INVALID_INVITE = "This invite link isn't valid or has already been used. If you think this is a mistake, join the waitlist again."

function renderWithProviders(ui: React.ReactElement) {
  return render(ui)
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn() // not implemented in jsdom
  vi.mocked(signIn).mockReset()
  vi.mocked(apiSignUp).mockResolvedValue({ id: '1', username: 'testuser', email: 'test@example.com' })
})

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

    it('renders dietary options as checkboxes', () => {
      renderWithProviders(<CreateAccount />)

      expect(screen.getByRole('checkbox', { name: /vegetarian/i })).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /vegan/i })).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /gluten-free/i })).toBeInTheDocument()
    })
  })

  describe('Username Validation', () => {
    it('shows hint for username requirements', () => {
      renderWithProviders(<CreateAccount />)

      expect(screen.getByText('3–30 characters, letters, numbers, hyphens and underscores only.')).toBeInTheDocument()
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
      expect(screen.getByText('✓ Not a common password')).toBeInTheDocument()
    })

    it('password field has toggle mask button', () => {
      renderWithProviders(<CreateAccount />)

      const toggleButtons = screen.getAllByRole('switch', { name: /show password/i })
      expect(toggleButtons.length).toBeGreaterThanOrEqual(1)
    })

    it('toggle mask reveals and hides the password field', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      const passwordInput = screen.getByPlaceholderText('Create a strong password')
      expect(passwordInput).toHaveAttribute('type', 'password')

      const [toggleButton] = screen.getAllByRole('switch', { name: /show password/i })
      await user.click(toggleButton)

      expect(passwordInput).toHaveAttribute('type', 'text')

      await user.click(screen.getAllByRole('switch', { name: /hide password/i })[0])
      expect(passwordInput).toHaveAttribute('type', 'password')
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

    it('does not allow common passwords like "password"', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      await user.type(screen.getByPlaceholderText('Choose a username'), 'testuser')
      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com')
      await user.type(screen.getByPlaceholderText('Create a strong password'), 'password')
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'password')

      const submitButton = screen.getByRole('button', { name: /create account/i })
      expect(submitButton).toBeDisabled()

      const commonPasswordRequirement = screen.getByText('✓ Not a common password')
      expect(commonPasswordRequirement).not.toHaveClass('valid')
    })

    it('does not allow common passwords like "qwerty123"', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      await user.type(screen.getByPlaceholderText('Choose a username'), 'testuser')
      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com')
      await user.type(screen.getByPlaceholderText('Create a strong password'), 'qwerty123')
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'qwerty123')

      const submitButton = screen.getByRole('button', { name: /create account/i })
      expect(submitButton).toBeDisabled()

      const commonPasswordRequirement = screen.getByText('✓ Not a common password')
      expect(commonPasswordRequirement).not.toHaveClass('valid')
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

    it('allows selecting a dietary restriction', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      const vegetarianCheckbox = screen.getByRole('checkbox', { name: /vegetarian/i })
      await user.click(vegetarianCheckbox)

      expect(vegetarianCheckbox).toBeChecked()
    })

    it('allows selecting multiple dietary restrictions', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      const vegetarianCheckbox = screen.getByRole('checkbox', { name: /vegetarian/i })
      const veganCheckbox = screen.getByRole('checkbox', { name: /vegan/i })

      await user.click(vegetarianCheckbox)
      await user.click(veganCheckbox)

      expect(vegetarianCheckbox).toBeChecked()
      expect(veganCheckbox).toBeChecked()
    })
  })

  describe('Navigation', () => {
    it('renders cancel button linking to home', () => {
      renderWithProviders(<CreateAccount />)

      const cancelButton = screen.getByRole('link', { name: /cancel/i })
      expect(cancelButton).toHaveAttribute('href', '/')
    })

    it('renders login link', () => {
      renderWithProviders(<CreateAccount />)

      const loginLink = screen.getByRole('link', { name: /login/i })
      expect(loginLink).toHaveAttribute('href', '/login')
    })

    it('signs in and goes to /welcome after successful account creation', async () => {
      vi.mocked(signIn).mockResolvedValue({ error: undefined, ok: true, status: 200, url: null } as never)
      const mockPush = vi.fn()
      vi.mocked(useRouter).mockReturnValue({
        push: mockPush, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn(),
      })

      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      await user.type(screen.getByPlaceholderText('Choose a username'), 'testuser')
      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com')
      await user.type(screen.getByPlaceholderText('Create a strong password'), 'StrongPass1!')
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'StrongPass1!')

      await user.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(signIn).toHaveBeenCalledWith('credentials', { username: 'testuser', password: 'StrongPass1!', redirect: false })
        expect(mockPush).toHaveBeenCalledWith('/welcome')
      })
    })
  })

  describe('API Integration', () => {
    it('calls apiSignUp with form data on submit', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      await user.type(screen.getByPlaceholderText('Choose a username'), 'testuser')
      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com')
      await user.type(screen.getByPlaceholderText('Create a strong password'), 'StrongPass1!')
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'StrongPass1!')

      await user.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(apiSignUp).toHaveBeenCalledWith({
          username: 'testuser',
          email: 'test@example.com',
          password: 'StrongPass1!',
          cuisinePreferences: [],
          dietaryRestrictions: [],
          marketingEmailOptIn: false,
        })
      })
    })

    it('calls apiSignUp with selected preferences', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      await user.type(screen.getByPlaceholderText('Choose a username'), 'testuser')
      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com')
      await user.type(screen.getByPlaceholderText('Create a strong password'), 'StrongPass1!')
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'StrongPass1!')

      await user.click(screen.getByRole('checkbox', { name: /italian/i }))
      await user.click(screen.getByRole('checkbox', { name: /vegan/i }))

      await user.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(apiSignUp).toHaveBeenCalledWith({
          username: 'testuser',
          email: 'test@example.com',
          password: 'StrongPass1!',
          cuisinePreferences: ['Italian'],
          dietaryRestrictions: ['Vegan'],
          marketingEmailOptIn: false,
        })
      })
    })

    it('shows error message when API returns an error', async () => {
      vi.mocked(apiSignUp).mockRejectedValue(new Error('Email already in use'))
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      await user.type(screen.getByPlaceholderText('Choose a username'), 'testuser')
      await user.type(screen.getByPlaceholderText('you@example.com'), 'taken@example.com')
      await user.type(screen.getByPlaceholderText('Create a strong password'), 'StrongPass1!')
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'StrongPass1!')

      await user.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Email already in use')
      })
    })

    it('disables submit button while submitting', async () => {
      let resolve!: (value: { id: string; username: string; email: string }) => void
      vi.mocked(apiSignUp).mockReturnValue(new Promise((r) => { resolve = r }))
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)

      await user.type(screen.getByPlaceholderText('Choose a username'), 'testuser')
      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com')
      await user.type(screen.getByPlaceholderText('Create a strong password'), 'StrongPass1!')
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'StrongPass1!')

      await user.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled()
      })

      resolve({ id: '1', username: 'testuser', email: 'test@example.com' })
    })
  })
  describe('Invite link', () => {
    async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, emailTyped?: string) {
      await user.type(screen.getByPlaceholderText('Choose a username'), 'testuser')
      if (emailTyped) await user.type(screen.getByPlaceholderText('you@example.com'), emailTyped)
      await user.type(screen.getByPlaceholderText('Create a strong password'), 'StrongPass1!')
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'StrongPass1!')
      await user.click(screen.getByRole('button', { name: /create account/i }))
    }

    it('prefills a read-only email and hides the code when the link carries both', () => {
      renderWithProviders(<CreateAccount email="invited@example.com" code="abc123" />)
      const email = screen.getByDisplayValue('invited@example.com')
      expect(email).toHaveAttribute('readonly')
      expect(screen.queryByText('abc123')).not.toBeInTheDocument()
      expect(screen.queryByDisplayValue('abc123')).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/invite code/i)).not.toBeInTheDocument()
    })

    it('sends the email and code from the link', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount email="invited@example.com" code="abc123" />)
      await fillAndSubmit(user)
      await waitFor(() => {
        expect(apiSignUp).toHaveBeenCalledWith(expect.objectContaining({ email: 'invited@example.com', code: 'abc123' }))
      })
    })

    it('shows the code field when the link has no code', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount email="invited@example.com" />)
      await user.type(screen.getByLabelText(/invite code/i), 'typed-code')
      await fillAndSubmit(user)
      await waitFor(() => {
        expect(apiSignUp).toHaveBeenCalledWith(expect.objectContaining({ code: 'typed-code' }))
      })
    })

    it('shows one banner with a waitlist link for a bad, used or missing code, above the form', async () => {
      vi.mocked(apiSignUp).mockRejectedValue(new InviteInvalidError())
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount email="invited@example.com" code="used" />)
      await fillAndSubmit(user)
      const banner = await screen.findByRole('alert')
      expect(banner).toHaveTextContent(INVALID_INVITE)
      expect(screen.getByRole('link', { name: /join the waitlist/i })).toHaveAttribute('href', '/waitlist')
      const form = screen.getByRole('button', { name: /create account/i }).closest('form')!
      expect(banner.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(signIn).not.toHaveBeenCalled()
    })

    it('shows the waitlist confirmation when the email is not invited', async () => {
      vi.mocked(apiSignUp).mockResolvedValue({ waitlisted: true })
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)
      await fillAndSubmit(user, 'stranger@example.com')
      expect(await screen.findByText(/You're on the list\. We'll email you when your invite is ready\./)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /create account/i })).not.toBeInTheDocument()
      expect(signIn).not.toHaveBeenCalled()
    })

    it('scrolls the invalid-invite banner into view and focuses it after a failed submit', async () => {
      const scrollIntoView = vi.fn()
      Element.prototype.scrollIntoView = scrollIntoView
      vi.mocked(apiSignUp).mockRejectedValue(new InviteInvalidError())
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount email="invited@example.com" code="used" />)
      expect(scrollIntoView).not.toHaveBeenCalled()
      expect(document.body).toHaveFocus()
      await fillAndSubmit(user)
      const banner = await screen.findByRole('alert')
      await waitFor(() => expect(banner).toHaveFocus())
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
      expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled()
    })

    it('scrolls to and focuses the waitlist confirmation', async () => {
      const scrollIntoView = vi.fn()
      Element.prototype.scrollIntoView = scrollIntoView
      vi.mocked(apiSignUp).mockResolvedValue({ waitlisted: true })
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)
      await fillAndSubmit(user, 'stranger@example.com')
      const message = await screen.findByRole('status')
      await waitFor(() => expect(message).toHaveFocus())
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
    })

    it('shows the username error under the field after blur', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CreateAccount />)
      const username = screen.getByPlaceholderText('Choose a username')
      await user.type(username, 'ab')
      expect(screen.queryByText(/at least 3 characters/i)).not.toBeInTheDocument()
      await user.tab()
      expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument()
      expect(username).toHaveAttribute('aria-invalid', 'true')
    })
  })
})
