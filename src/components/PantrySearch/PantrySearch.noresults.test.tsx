import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PantrySearch from './PantrySearch'

vi.mock('@/lib/api/pantry', () => ({
  apiFetchPantryItems: vi.fn(),
}))

import { apiFetchPantryItems } from '@/lib/api/pantry'

const MESSAGE = 'Nothing in your pantry matches'

describe('PantrySearch no-results message', () => {
  beforeEach(() => {
    vi.mocked(apiFetchPantryItems).mockReset()
    vi.mocked(apiFetchPantryItems).mockResolvedValue([])
  })

  it('has an always-present polite live region', () => {
    render(<PantrySearch onSelect={vi.fn()} />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toBeEmptyDOMElement()
  })

  it('shows the message after the debounce completes with no matches', async () => {
    const user = userEvent.setup()
    render(<PantrySearch onSelect={vi.fn()} />)
    await user.type(screen.getByRole('combobox'), 'zzzz')
    expect(screen.getByRole('status')).not.toHaveTextContent(MESSAGE)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(MESSAGE))
  })

  it('hides the message when the user keeps typing', async () => {
    const user = userEvent.setup()
    render(<PantrySearch onSelect={vi.fn()} />)
    const input = screen.getByRole('combobox')
    await user.type(input, 'zz')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(MESSAGE))
    await user.type(input, 'z')
    expect(screen.getByRole('status')).not.toHaveTextContent(MESSAGE)
  })

  it('does not leave the message stuck after a failed search', async () => {
    const user = userEvent.setup()
    render(<PantrySearch onSelect={vi.fn()} />)
    const input = screen.getByRole('combobox')
    await user.type(input, 'zz')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(MESSAGE))
    vi.mocked(apiFetchPantryItems).mockRejectedValue(new Error('boom'))
    await user.type(input, 'z')
    await waitFor(() => expect(apiFetchPantryItems).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByRole('status')).not.toHaveTextContent(MESSAGE))
  })

  it('hides the message when the input is emptied', async () => {
    const user = userEvent.setup()
    render(<PantrySearch onSelect={vi.fn()} />)
    const input = screen.getByRole('combobox')
    await user.type(input, 'zz')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(MESSAGE))
    await user.clear(input)
    expect(screen.getByRole('status')).not.toHaveTextContent(MESSAGE)
  })
})
