import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminWaitlist from './AdminWaitlist'
import type { WaitlistAdminRow } from '@/lib/api/waitlistAdmin'

const api = vi.hoisted(() => ({
  apiListWaitlist: vi.fn(),
  apiInvite: vi.fn(),
  apiRevokeInvite: vi.fn(),
  apiDeleteWaitlistEntry: vi.fn(),
}))
vi.mock('@/lib/api/waitlistAdmin', () => api)

function row(over: Partial<WaitlistAdminRow>): WaitlistAdminRow {
  return {
    entryId: 1,
    email: 'pat@example.com',
    name: null,
    marketingEmailOptIn: false,
    dateAdded: '2026-11-20T12:00:00.000Z',
    inviteId: null,
    invited: false,
    hasAccount: false,
    ...over,
  }
}

const pending = row({ entryId: 1, email: 'pat@example.com', marketingEmailOptIn: true })
const invited = row({ entryId: 2, email: 'sam@example.com', invited: true, inviteId: 20, hasAccount: true })

function renderPage(emailsEnabled = true) {
  return render(<AdminWaitlist emailsEnabled={emailsEnabled} />)
}

function rowOf(email: string) {
  return screen.getByText(email).closest('li') as HTMLElement
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  api.apiListWaitlist.mockResolvedValue([pending, invited])
})

describe('AdminWaitlist', () => {
  it('shows skeleton rows while loading', () => {
    api.apiListWaitlist.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getAllByTestId('waitlist-skeleton')).toHaveLength(3)
  })

  it('shows the empty text', async () => {
    api.apiListWaitlist.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('No one is on the waitlist yet.')).toBeInTheDocument()
  })

  it('shows a banner with Retry when loading fails, and Retry reloads', async () => {
    api.apiListWaitlist.mockRejectedValueOnce(new Error('Boom'))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Boom')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('pat@example.com')).toBeInTheDocument()
  })

  it('lists entries with opt-in, Invited mark and has-account', async () => {
    renderPage()
    await screen.findByText('pat@example.com')
    expect(within(rowOf('pat@example.com')).getByText('Marketing opt-in')).toBeInTheDocument()
    expect(within(rowOf('pat@example.com')).getByRole('button', { name: 'Invite' })).toBeInTheDocument()
    const sam = rowOf('sam@example.com')
    expect(within(sam).getByText('Invited')).toBeInTheDocument()
    expect(within(sam).getByText('Has account')).toBeInTheDocument()
    expect(within(sam).getByRole('button', { name: 'Revoke' })).toBeInTheDocument()
    expect(within(sam).queryByRole('button', { name: 'Invite' })).toBeNull()
  })

  it('invites an entry, flips the row to Invited and toasts', async () => {
    api.apiInvite.mockResolvedValue({ status: 'created', inviteId: 9, email: 'pat@example.com', code: 'X', emailSent: true })
    renderPage()
    await screen.findByText('pat@example.com')
    await userEvent.click(within(rowOf('pat@example.com')).getByRole('button', { name: 'Invite' }))
    expect(api.apiInvite).toHaveBeenCalledWith({ entryId: 1 })
    expect(await screen.findByText('Invite sent to pat@example.com')).toBeInTheDocument()
    expect(within(rowOf('pat@example.com')).getByText('Invited')).toBeInTheDocument()
  })

  it('toasts that the email was not sent when emails are disabled', async () => {
    api.apiInvite.mockResolvedValue({ status: 'created', inviteId: 9, email: 'pat@example.com', code: 'X', emailSent: true })
    renderPage(false)
    await screen.findByText('pat@example.com')
    await userEvent.click(within(rowOf('pat@example.com')).getByRole('button', { name: 'Invite' }))
    expect(await screen.findByText('Invite created (email not sent in this environment)')).toBeInTheDocument()
  })

  it('shows a row-level error and keeps the row usable when an invite fails', async () => {
    api.apiInvite.mockRejectedValue(new Error('Something went wrong'))
    renderPage()
    await screen.findByText('pat@example.com')
    await userEvent.click(within(rowOf('pat@example.com')).getByRole('button', { name: 'Invite' }))
    expect(await within(rowOf('pat@example.com')).findByRole('alert')).toHaveTextContent('Something went wrong')
    expect(within(rowOf('pat@example.com')).getByRole('button', { name: 'Invite' })).toBeEnabled()
  })

  it('shows a row note for Already invited as neutral, but the same API error text stays a red error', async () => {
    api.apiInvite.mockResolvedValueOnce({ status: 'already-invited' })
    renderPage()
    await screen.findByText('pat@example.com')
    const pat = () => rowOf('pat@example.com')
    await userEvent.click(within(pat()).getByRole('button', { name: 'Invite' }))
    const note = await within(pat()).findByText('Already invited')
    expect(note.className).toContain('is-note')
    expect(within(pat()).queryByRole('alert')).toBeNull()

    api.apiInvite.mockRejectedValueOnce(new Error('Already invited'))
    await userEvent.click(within(pat()).getByRole('button', { name: 'Invite' }))
    await waitFor(() => expect(within(pat()).getByRole('alert')).toHaveTextContent('Already invited'))
    expect(within(pat()).getByRole('alert').className).toContain('is-error')
  })

  it('revokes after an inline confirm', async () => {
    api.apiRevokeInvite.mockResolvedValue(undefined)
    renderPage()
    await screen.findByText('sam@example.com')
    await userEvent.click(within(rowOf('sam@example.com')).getByRole('button', { name: 'Revoke' }))
    expect(api.apiRevokeInvite).not.toHaveBeenCalled()
    expect(within(rowOf('sam@example.com')).getByText('Revoke the invite for sam@example.com.')).toBeInTheDocument()
    await userEvent.click(within(rowOf('sam@example.com')).getByRole('button', { name: 'Confirm' }))
    expect(api.apiRevokeInvite).toHaveBeenCalledWith(20)
    await waitFor(() => expect(within(rowOf('sam@example.com')).queryByText('Invited')).toBeNull())
  })

  it('cancels a confirm without calling the API', async () => {
    renderPage()
    await screen.findByText('pat@example.com')
    await userEvent.click(within(rowOf('pat@example.com')).getByRole('button', { name: 'Delete' }))
    expect(
      within(rowOf('pat@example.com')).getByText('Delete pat@example.com from the waitlist? Their account, if any, is kept.'),
    ).toBeInTheDocument()
    await userEvent.click(within(rowOf('pat@example.com')).getByRole('button', { name: 'Cancel' }))
    expect(api.apiDeleteWaitlistEntry).not.toHaveBeenCalled()
    expect(within(rowOf('pat@example.com')).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('deletes an entry after confirm and removes the row', async () => {
    api.apiDeleteWaitlistEntry.mockResolvedValue(undefined)
    renderPage()
    await screen.findByText('pat@example.com')
    await userEvent.click(within(rowOf('pat@example.com')).getByRole('button', { name: 'Delete' }))
    await userEvent.click(within(rowOf('pat@example.com')).getByRole('button', { name: 'Confirm' }))
    expect(api.apiDeleteWaitlistEntry).toHaveBeenCalledWith(1)
    await waitFor(() => expect(screen.queryByText('pat@example.com')).toBeNull())
  })

  it('shows a row error when delete fails', async () => {
    api.apiDeleteWaitlistEntry.mockRejectedValue(new Error('Nope'))
    renderPage()
    await screen.findByText('pat@example.com')
    await userEvent.click(within(rowOf('pat@example.com')).getByRole('button', { name: 'Delete' }))
    await userEvent.click(within(rowOf('pat@example.com')).getByRole('button', { name: 'Confirm' }))
    expect(await within(rowOf('pat@example.com')).findByRole('alert')).toHaveTextContent('Nope')
    expect(screen.getByText('pat@example.com')).toBeInTheDocument()
  })

  describe('Invite an email box', () => {
    async function submit(value: string) {
      await screen.findByText('pat@example.com')
      await userEvent.type(screen.getByLabelText('Invite an email'), value)
      await userEvent.click(screen.getByRole('button', { name: 'Send invite' }))
    }

    it('invites a valid email and toasts', async () => {
      api.apiInvite.mockResolvedValue({ status: 'created', inviteId: 5, email: 'new@example.com', code: 'X', emailSent: true })
      renderPage()
      await submit('new@example.com')
      expect(api.apiInvite).toHaveBeenCalledWith({ email: 'new@example.com' })
      expect(await screen.findByText('Invite sent to new@example.com')).toBeInTheDocument()
    })

    it('shows a validation error under the field and does not call the API', async () => {
      renderPage()
      await submit('pat@')
      expect(screen.getByText('Enter a valid email like pat@example.com')).toBeInTheDocument()
      expect(api.apiInvite).not.toHaveBeenCalled()
    })

    it('shows Already invited as a neutral note, not an error', async () => {
      api.apiInvite.mockResolvedValue({ status: 'already-invited' })
      renderPage()
      await submit('sam@example.com')
      const note = await screen.findByText('Already invited')
      expect(note).toBeInTheDocument()
      expect(note.closest('[role="alert"]')).toBeNull()
      expect(screen.queryByText(/Invite sent/)).toBeNull()
    })

    it('shows a failure message under the field', async () => {
      api.apiInvite.mockRejectedValue(new Error('Server down'))
      renderPage()
      await submit('new@example.com')
      expect(await screen.findByText('Server down')).toBeInTheDocument()
    })
  })
})
