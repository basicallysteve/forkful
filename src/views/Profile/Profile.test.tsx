import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Profile from './Profile'
import type { User } from '@/types/User'

const { mockUpdate } = vi.hoisted(() => ({ mockUpdate: vi.fn() }))

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: { user: { name: 'testuser' } }, status: 'authenticated', update: mockUpdate })),
  signOut: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/api/users', () => ({
  apiUpdatePreferences: vi.fn().mockResolvedValue(undefined),
  apiUpdateEmail: vi.fn().mockResolvedValue(undefined),
  apiUpdatePassword: vi.fn().mockResolvedValue(undefined),
  apiUploadAvatar: vi.fn().mockResolvedValue({ url: 'https://example.com/new-avatar.jpg' }),
  apiUpdateUsername: vi.fn().mockResolvedValue(undefined),
  apiUpdateEmailPreferences: vi.fn().mockResolvedValue(undefined),
  apiDeactivateAccount: vi.fn().mockResolvedValue(undefined),
  apiDeleteAccount: vi.fn().mockResolvedValue(undefined),
  apiSubmitAccountFeedback: vi.fn().mockResolvedValue(undefined),
}))

import {
  apiUpdatePreferences,
  apiUpdateEmail,
  apiUpdateUsername,
  apiUpdateEmailPreferences,
  apiDeactivateAccount,
  apiDeleteAccount,
  apiSubmitAccountFeedback,
} from '@/lib/api/users'

const mockUser: User = {
  id: '1',
  username: 'testuser',
  email: 'test@example.com',
  hasPassword: true,
  cuisinePreferences: ['Italian'],
  dietaryRestrictions: ['Vegan'],
  avatarUrl: null,
  marketingEmailOptIn: true,
  recipeSuggestionFrequency: 'weekly',
  pantryExpirationFrequency: 'daily',
  dateAdded: new Date('2024-01-01'),
  dateDeleted: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiUpdatePreferences).mockResolvedValue(undefined)
  vi.mocked(apiUpdateEmail).mockResolvedValue(undefined)
  vi.mocked(apiUpdateUsername).mockResolvedValue(undefined)
  vi.mocked(apiUpdateEmailPreferences).mockResolvedValue(undefined)
  vi.mocked(apiDeactivateAccount).mockResolvedValue(undefined)
  vi.mocked(apiDeleteAccount).mockResolvedValue(undefined)
  vi.mocked(apiSubmitAccountFeedback).mockResolvedValue(undefined)
})

describe('Profile', () => {
  describe('rendering', () => {
    it('renders username and email in the header', () => {
      render(<Profile user={mockUser} />)
      expect(screen.getByRole('heading', { name: 'testuser' })).toBeInTheDocument()
      expect(screen.getByText('test@example.com')).toBeInTheDocument()
    })

    it('renders the avatar initial when no avatarUrl is set', () => {
      render(<Profile user={mockUser} />)
      // First letter of 'testuser' uppercased
      expect(screen.getByText('T')).toBeInTheDocument()
    })

    it('renders the avatar image when avatarUrl is set', () => {
      render(<Profile user={{ ...mockUser, avatarUrl: 'https://example.com/avatar.jpg' }} />)
      const img = screen.getByRole('img', { name: 'testuser' })
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg')
    })

    it('renders all panel section headings', () => {
      render(<Profile user={mockUser} />)
      // 'Username' appears in both the tab heading and the form field label
      expect(screen.getAllByText('Username').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Preferences')).toBeInTheDocument()
      expect(screen.getByText('Email Preferences')).toBeInTheDocument()
      expect(screen.getByText('Account')).toBeInTheDocument()
      expect(screen.getByText('Account Management')).toBeInTheDocument()
    })

    it('renders the Billing & Payments placeholder with Coming soon badge', () => {
      render(<Profile user={mockUser} />)
      expect(screen.getByText('Billing & Payments')).toBeInTheDocument()
      expect(screen.getByText('Coming soon')).toBeInTheDocument()
    })
  })

  describe('username form', () => {
    it('shows the current username in the input field', () => {
      render(<Profile user={mockUser} />)
      expect(screen.getByDisplayValue('testuser')).toBeInTheDocument()
    })

    it('disables Update Username button when username is unchanged', () => {
      render(<Profile user={mockUser} />)
      expect(screen.getByRole('button', { name: /update username/i })).toBeDisabled()
    })

    it('shows a validation error for a username that is too short', async () => {
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      const input = screen.getByDisplayValue('testuser')
      await user.clear(input)
      await user.type(input, 'ab')
      expect(screen.getByRole('alert')).toHaveTextContent(/3.30 characters/i)
    })

    it('disables Update Username button for an invalid username', async () => {
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      const input = screen.getByDisplayValue('testuser')
      await user.clear(input)
      await user.type(input, 'ab')
      expect(screen.getByRole('button', { name: /update username/i })).toBeDisabled()
    })

    it('enables Update Username button after a valid change', async () => {
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      const input = screen.getByDisplayValue('testuser')
      await user.clear(input)
      await user.type(input, 'newusername')
      expect(screen.getByRole('button', { name: /update username/i })).not.toBeDisabled()
    })

    it('calls apiUpdateUsername with the new username on submit', async () => {
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      const input = screen.getByDisplayValue('testuser')
      await user.clear(input)
      await user.type(input, 'newusername')
      await user.click(screen.getByRole('button', { name: /update username/i }))
      await waitFor(() => {
        expect(apiUpdateUsername).toHaveBeenCalledWith('1', 'newusername')
      })
    })

    it('shows a success message after a successful username update', async () => {
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      const input = screen.getByDisplayValue('testuser')
      await user.clear(input)
      await user.type(input, 'newusername')
      await user.click(screen.getByRole('button', { name: /update username/i }))
      await waitFor(() => {
        expect(screen.getByText('Username updated!')).toBeInTheDocument()
      })
    })

    it('shows an error message when the username update fails', async () => {
      vi.mocked(apiUpdateUsername).mockRejectedValueOnce(new Error('Username already taken'))
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      const input = screen.getByDisplayValue('testuser')
      await user.clear(input)
      await user.type(input, 'newusername')
      await user.click(screen.getByRole('button', { name: /update username/i }))
      await waitFor(() => {
        expect(screen.getByText('Username already taken')).toBeInTheDocument()
      })
    })
  })

  describe('preferences', () => {
    it('renders all cuisine options', () => {
      render(<Profile user={mockUser} />)
      expect(screen.getByText('Italian')).toBeInTheDocument()
      expect(screen.getByText('Mexican')).toBeInTheDocument()
      expect(screen.getByText('Caribbean')).toBeInTheDocument()
    })

    it('renders all dietary restriction options', () => {
      render(<Profile user={mockUser} />)
      expect(screen.getByText('Vegan')).toBeInTheDocument()
      expect(screen.getByText('Vegetarian')).toBeInTheDocument()
      expect(screen.getByText('Gluten-Free')).toBeInTheDocument()
    })

    it('marks pre-selected cuisine preference as active', () => {
      render(<Profile user={mockUser} />)
      const italianLabel = screen.getByText('Italian').closest('label')
      expect(italianLabel).toHaveClass('is-active')
    })

    it('does not mark unselected cuisine as active', () => {
      render(<Profile user={mockUser} />)
      const mexicanLabel = screen.getByText('Mexican').closest('label')
      expect(mexicanLabel).not.toHaveClass('is-active')
    })

    it('marks pre-selected dietary restriction as active', () => {
      render(<Profile user={mockUser} />)
      const veganLabel = screen.getByText('Vegan').closest('label')
      expect(veganLabel).toHaveClass('is-active')
    })

    it('toggles a cuisine option on when clicked', async () => {
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      const mexicanLabel = screen.getByText('Mexican').closest('label')!
      expect(mexicanLabel).not.toHaveClass('is-active')
      await user.click(mexicanLabel)
      expect(mexicanLabel).toHaveClass('is-active')
    })

    it('toggles a cuisine option off when clicked again', async () => {
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      const italianLabel = screen.getByText('Italian').closest('label')!
      expect(italianLabel).toHaveClass('is-active')
      await user.click(italianLabel)
      expect(italianLabel).not.toHaveClass('is-active')
    })

    it('calls apiUpdatePreferences with current selections on save', async () => {
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      await user.click(screen.getByRole('button', { name: /save preferences/i }))
      await waitFor(() => {
        expect(apiUpdatePreferences).toHaveBeenCalledWith({
          userId: '1',
          cuisinePreferences: ['Italian'],
          dietaryRestrictions: ['Vegan'],
        })
      })
    })

    it('shows a success message after saving preferences', async () => {
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      await user.click(screen.getByRole('button', { name: /save preferences/i }))
      await waitFor(() => {
        // The Saved! text is scoped to the preferences panel footer
        const saveBtn = screen.getByRole('button', { name: /save preferences/i })
        expect(saveBtn.closest('.panel-content')?.querySelector('.success-text')).toHaveTextContent('Saved!')
      })
    })

    it('shows an error message when saving preferences fails', async () => {
      vi.mocked(apiUpdatePreferences).mockRejectedValueOnce(new Error('Server error'))
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      await user.click(screen.getByRole('button', { name: /save preferences/i }))
      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument()
      })
    })
  })

  describe('email preferences', () => {
    it('renders the Save Email Preferences button', () => {
      render(<Profile user={mockUser} />)
      expect(screen.getByRole('button', { name: /save email preferences/i })).toBeInTheDocument()
    })

    it('renders the marketing emails opt-in checkbox', () => {
      render(<Profile user={mockUser} />)
      expect(screen.getByText(/receive news and marketing emails/i)).toBeInTheDocument()
    })

    it('marks marketing opt-in as active when user has opted in', () => {
      render(<Profile user={mockUser} />)
      const label = screen.getByText(/receive news and marketing emails/i).closest('label')!
      expect(label).toHaveClass('is-active')
    })

    it('marks marketing opt-in as inactive when user has not opted in', () => {
      render(<Profile user={{ ...mockUser, marketingEmailOptIn: false }} />)
      const label = screen.getByText(/receive news and marketing emails/i).closest('label')!
      expect(label).not.toHaveClass('is-active')
    })

    it('calls apiUpdateEmailPreferences with current values on save', async () => {
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      await user.click(screen.getByRole('button', { name: /save email preferences/i }))
      await waitFor(() => {
        expect(apiUpdateEmailPreferences).toHaveBeenCalledWith('1', {
          marketingEmailOptIn: true,
          recipeSuggestionFrequency: 'weekly',
          pantryExpirationFrequency: 'daily',
        })
      })
    })

    it('shows an error message when saving email preferences fails', async () => {
      vi.mocked(apiUpdateEmailPreferences).mockRejectedValueOnce(new Error('Email preferences error'))
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      await user.click(screen.getByRole('button', { name: /save email preferences/i }))
      await waitFor(() => {
        expect(screen.getByText('Email preferences error')).toBeInTheDocument()
      })
    })
  })

  describe('account section – password-based user', () => {
    it('renders the email input with the current email address', () => {
      render(<Profile user={mockUser} />)
      expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument()
    })

    it('renders the password form field labels', () => {
      render(<Profile user={mockUser} />)
      expect(screen.getByText('Current Password')).toBeInTheDocument()
      expect(screen.getByText('New Password')).toBeInTheDocument()
      expect(screen.getByText('Confirm New Password')).toBeInTheDocument()
    })

    it('renders Update Email and Update Password buttons', () => {
      render(<Profile user={mockUser} />)
      expect(screen.getByRole('button', { name: /update email/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument()
    })

    it('disables Update Email when the email is invalid', async () => {
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      const emailInput = screen.getByDisplayValue('test@example.com')
      await user.clear(emailInput)
      await user.type(emailInput, 'not-an-email')
      expect(screen.getByRole('button', { name: /update email/i })).toBeDisabled()
    })

    it('shows an email validation error for an invalid address', async () => {
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      const emailInput = screen.getByDisplayValue('test@example.com')
      await user.clear(emailInput)
      await user.type(emailInput, 'not-an-email')
      expect(screen.getByText(/valid email address/i)).toBeInTheDocument()
    })

    it('calls apiUpdateEmail on email form submit', async () => {
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      const emailInput = screen.getByDisplayValue('test@example.com')
      await user.clear(emailInput)
      await user.type(emailInput, 'newemail@example.com')
      await user.click(screen.getByRole('button', { name: /update email/i }))
      await waitFor(() => {
        expect(apiUpdateEmail).toHaveBeenCalledWith('1', 'newemail@example.com')
      })
    })

    it('shows a success message after email update', async () => {
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      const emailInput = screen.getByDisplayValue('test@example.com')
      await user.clear(emailInput)
      await user.type(emailInput, 'newemail@example.com')
      await user.click(screen.getByRole('button', { name: /update email/i }))
      await waitFor(() => {
        expect(screen.getByText('Email updated!')).toBeInTheDocument()
      })
    })

    it('shows an error message when the email update fails', async () => {
      vi.mocked(apiUpdateEmail).mockRejectedValueOnce(new Error('Email already in use'))
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      const emailInput = screen.getByDisplayValue('test@example.com')
      await user.clear(emailInput)
      await user.type(emailInput, 'newemail@example.com')
      await user.click(screen.getByRole('button', { name: /update email/i }))
      await waitFor(() => {
        expect(screen.getByText('Email already in use')).toBeInTheDocument()
      })
    })

    it('disables Update Password when passwords do not match', async () => {
      const user = userEvent.setup()
      const { container } = render(<Profile user={mockUser} />)
      const newPwInput = container.querySelectorAll<HTMLInputElement>('input[autocomplete="new-password"]')[0]
      const confirmPwInput = container.querySelectorAll<HTMLInputElement>('input[autocomplete="new-password"]')[1]
      await user.type(newPwInput, 'NewPass123!')
      await user.type(confirmPwInput, 'Different123!')
      expect(screen.getByRole('button', { name: /update password/i })).toBeDisabled()
    })

    it('shows a mismatch error when confirm password differs from new password', async () => {
      const user = userEvent.setup()
      const { container } = render(<Profile user={mockUser} />)
      const newPwInput = container.querySelectorAll<HTMLInputElement>('input[autocomplete="new-password"]')[0]
      const confirmPwInput = container.querySelectorAll<HTMLInputElement>('input[autocomplete="new-password"]')[1]
      await user.type(newPwInput, 'NewPass123!')
      await user.type(confirmPwInput, 'Different123!')
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })

    it('shows password requirement hints when new password does not meet requirements', async () => {
      const user = userEvent.setup()
      const { container } = render(<Profile user={mockUser} />)
      const newPwInput = container.querySelectorAll<HTMLInputElement>('input[autocomplete="new-password"]')[0]
      await user.type(newPwInput, 'weak')
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    })
  })

  describe('account section – OAuth user', () => {
    const oauthUser: User = { ...mockUser, hasPassword: false }

    it('shows the OAuth account note', () => {
      render(<Profile user={oauthUser} />)
      expect(screen.getByText(/account is managed by an identity provider/i)).toBeInTheDocument()
    })

    it('does not render the Update Email button', () => {
      render(<Profile user={oauthUser} />)
      expect(screen.queryByRole('button', { name: /update email/i })).not.toBeInTheDocument()
    })

    it('does not render the Update Password button', () => {
      render(<Profile user={oauthUser} />)
      expect(screen.queryByRole('button', { name: /update password/i })).not.toBeInTheDocument()
    })
  })

  describe('danger zone', () => {
    it('renders Deactivate and Delete Account buttons', () => {
      render(<Profile user={mockUser} />)
      expect(screen.getByRole('button', { name: /^deactivate$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^delete account$/i })).toBeInTheDocument()
    })

    it('opens the deactivation modal when Deactivate is clicked', async () => {
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      await user.click(screen.getByRole('button', { name: /^deactivate$/i }))
      await waitFor(() => {
        expect(screen.getByText('Deactivate your account?')).toBeInTheDocument()
      })
    })

    it('opens the delete modal when Delete Account is clicked', async () => {
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      await user.click(screen.getByRole('button', { name: /^delete account$/i }))
      await waitFor(() => {
        expect(screen.getByText('Delete your account?')).toBeInTheDocument()
      })
    })

    it('shows the correct confirmation button label in the deactivation modal', async () => {
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      await user.click(screen.getByRole('button', { name: /^deactivate$/i }))
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /yes, deactivate my account/i })).toBeInTheDocument()
      })
    })

    it('shows the correct confirmation button label in the delete modal', async () => {
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      await user.click(screen.getByRole('button', { name: /^delete account$/i }))
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /yes, permanently delete my account/i })).toBeInTheDocument()
      })
    })

    it('shows closure reasons inside the deactivation modal', async () => {
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      await user.click(screen.getByRole('button', { name: /^deactivate$/i }))
      await waitFor(() => {
        expect(screen.getByText('Not using it enough')).toBeInTheDocument()
        expect(screen.getByText('Missing features')).toBeInTheDocument()
        expect(screen.getByText('Privacy concerns')).toBeInTheDocument()
      })
    })

    it('calls apiSubmitAccountFeedback and apiDeactivateAccount on deactivation confirm', async () => {
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      await user.click(screen.getByRole('button', { name: /^deactivate$/i }))
      await waitFor(() => screen.getByRole('button', { name: /yes, deactivate my account/i }))
      await user.click(screen.getByRole('button', { name: /yes, deactivate my account/i }))
      await waitFor(() => {
        expect(apiSubmitAccountFeedback).toHaveBeenCalledWith('1', expect.objectContaining({ action: 'deactivated' }))
        expect(apiDeactivateAccount).toHaveBeenCalledWith('1')
      })
    })

    it('calls apiSubmitAccountFeedback and apiDeleteAccount on deletion confirm', async () => {
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      await user.click(screen.getByRole('button', { name: /^delete account$/i }))
      await waitFor(() => screen.getByRole('button', { name: /yes, permanently delete my account/i }))
      await user.click(screen.getByRole('button', { name: /yes, permanently delete my account/i }))
      await waitFor(() => {
        expect(apiSubmitAccountFeedback).toHaveBeenCalledWith('1', expect.objectContaining({ action: 'deleted' }))
        expect(apiDeleteAccount).toHaveBeenCalledWith('1')
      })
    })

    it('shows an error when deactivation fails', async () => {
      vi.mocked(apiDeactivateAccount).mockRejectedValueOnce(new Error('Deactivation failed'))
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      await user.click(screen.getByRole('button', { name: /^deactivate$/i }))
      await waitFor(() => screen.getByRole('button', { name: /yes, deactivate my account/i }))
      await user.click(screen.getByRole('button', { name: /yes, deactivate my account/i }))
      await waitFor(() => {
        expect(screen.getByText('Deactivation failed')).toBeInTheDocument()
      })
    })

    it('shows an error when account deletion fails', async () => {
      vi.mocked(apiDeleteAccount).mockRejectedValueOnce(new Error('Deletion failed'))
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      await user.click(screen.getByRole('button', { name: /^delete account$/i }))
      await waitFor(() => screen.getByRole('button', { name: /yes, permanently delete my account/i }))
      await user.click(screen.getByRole('button', { name: /yes, permanently delete my account/i }))
      await waitFor(() => {
        expect(screen.getByText('Deletion failed')).toBeInTheDocument()
      })
    })

    it('includes selected closure reasons in the feedback payload', async () => {
      const user = userEvent.setup()
      render(<Profile user={mockUser} />)
      await user.click(screen.getByRole('button', { name: /^deactivate$/i }))
      await waitFor(() => screen.getByText('Not using it enough'))
      await user.click(screen.getByText('Not using it enough').closest('label')!)
      await user.click(screen.getByRole('button', { name: /yes, deactivate my account/i }))
      await waitFor(() => {
        expect(apiSubmitAccountFeedback).toHaveBeenCalledWith('1', expect.objectContaining({
          reasons: ['Not using it enough'],
        }))
      })
    })
  })
})
