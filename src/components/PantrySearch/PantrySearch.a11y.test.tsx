import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PantrySearch from './PantrySearch'
import type { PantryItem } from '@/types/PantryItem'

vi.mock('@/lib/api/pantry', () => ({ apiFetchPantryItems: vi.fn() }))
import { apiFetchPantryItems } from '@/lib/api/pantry'

function item(id: number, name: string): PantryItem {
  return {
    id,
    sourceType: 'food',
    food: { id, name },
    currentSize: { size: 1, unit: 'kg' },
  } as unknown as PantryItem
}

describe('PantrySearch accessibility', () => {
  beforeEach(() => {
    vi.mocked(apiFetchPantryItems).mockReset()
  })

  it('names the input', () => {
    vi.mocked(apiFetchPantryItems).mockResolvedValue([])
    render(<PantrySearch onSelect={vi.fn()} inputAriaLabel="Pantry item" />)
    expect(screen.getByRole('combobox', { name: 'Pantry item' })).toBeInTheDocument()
  })

  it('has a default accessible name when none is given', () => {
    vi.mocked(apiFetchPantryItems).mockResolvedValue([])
    render(<PantrySearch onSelect={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: 'Search your pantry' })).toBeInTheDocument()
  })

  it('announces Searching… then the result count in the one live region', async () => {
    vi.mocked(apiFetchPantryItems).mockResolvedValue([item(1, 'Flour'), item(2, 'Flax')])
    const user = userEvent.setup()
    render(<PantrySearch onSelect={vi.fn()} inputAriaLabel="Pantry item" />)
    await user.type(screen.getByRole('combobox'), 'fl')
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('Searching…')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2 results'))
  })

  it('follows the highlighted option with aria-activedescendant', async () => {
    vi.mocked(apiFetchPantryItems).mockResolvedValue([item(1, 'Flour'), item(2, 'Flax')])
    const user = userEvent.setup()
    render(<PantrySearch onSelect={vi.fn()} inputAriaLabel="Pantry item" />)
    const input = screen.getByRole('combobox')
    await user.type(input, 'fl')
    await screen.findByRole('option', { name: /Flour/ })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'))
    expect(document.getElementById(input.getAttribute('aria-activedescendant')!)).toHaveTextContent('Flour')
  })
})
