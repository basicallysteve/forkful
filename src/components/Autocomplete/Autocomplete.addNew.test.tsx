import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import Autocomplete from './Autocomplete'

const fruits = ['Apple', 'Banana', 'Blueberry']

function Harness({
  onAddNew,
  onSelect = vi.fn(),
  onChange = vi.fn(),
}: {
  onAddNew?: (name: string) => void
  onSelect?: (o: string) => void
  onChange?: (v: string) => void
}) {
  const [value, setValue] = useState('')
  return (
    <Autocomplete
      value={value}
      options={fruits}
      getOptionLabel={(o) => o}
      onChange={(v) => { setValue(v); onChange(v) }}
      onSelect={onSelect}
      onAddNew={onAddNew}
      addNewLabel={(name) => `Add "${name}" as a new food`}
      placeholder="Ingredient"
    />
  )
}

describe('Autocomplete add-new row', () => {
  it('offers no add row when onAddNew is not given', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByPlaceholderText('Ingredient'), 'zzz')
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  it('shows the add row, with the typed text, when nothing matches', async () => {
    const user = userEvent.setup()
    render(<Harness onAddNew={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Ingredient'), 'Dragon fruit')
    expect(screen.getByRole('option', { name: 'Add "Dragon fruit" as a new food' })).toBeInTheDocument()
  })

  it('shows the add row below partial matches', async () => {
    const user = userEvent.setup()
    render(<Harness onAddNew={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Ingredient'), 'blue')
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveTextContent('Blueberry')
    expect(options[1]).toHaveTextContent('Add "blue" as a new food')
  })

  it('does not show the add row when an option has exactly that name, ignoring case', async () => {
    const user = userEvent.setup()
    render(<Harness onAddNew={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Ingredient'), 'APPLE')
    expect(screen.getByRole('option', { name: /apple/i })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /as a new food/i })).not.toBeInTheDocument()
  })

  it('does not show the add row for an empty query', async () => {
    const user = userEvent.setup()
    render(<Harness onAddNew={vi.fn()} />)
    await user.click(screen.getByPlaceholderText('Ingredient'))
    expect(screen.queryByRole('option', { name: /as a new food/i })).not.toBeInTheDocument()
  })

  it('calls onAddNew with the typed text when the add row is clicked, without selecting', async () => {
    const user = userEvent.setup()
    const onAddNew = vi.fn()
    const onSelect = vi.fn()
    render(<Harness onAddNew={onAddNew} onSelect={onSelect} />)
    const input = screen.getByPlaceholderText('Ingredient')
    await user.type(input, 'Dragon fruit')
    await user.click(screen.getByRole('option', { name: /as a new food/i }))
    expect(onAddNew).toHaveBeenCalledWith('Dragon fruit')
    expect(onSelect).not.toHaveBeenCalled()
    expect(input).toHaveValue('Dragon fruit')
  })

  it('reaches the add row with the keyboard and opens it with Enter', async () => {
    const user = userEvent.setup()
    const onAddNew = vi.fn()
    render(<Harness onAddNew={onAddNew} />)
    await user.type(screen.getByPlaceholderText('Ingredient'), 'zzz')
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onAddNew).toHaveBeenCalledWith('zzz')
  })

  it('announces that adding is available when nothing matches', async () => {
    const user = userEvent.setup()
    render(<Harness onAddNew={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Ingredient'), 'zzz')
    expect(screen.getByRole('status')).toHaveTextContent('No matches. Add as new food is available')
  })

  it('counts only real matches in the announcement, not the add row', async () => {
    const user = userEvent.setup()
    render(<Harness onAddNew={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Ingredient'), 'blue')
    expect(screen.getByRole('status')).toHaveTextContent('1 result')
  })

  it('keeps a long typed name in the row as a tooltip and accessible name, so CSS can truncate it', async () => {
    const user = userEvent.setup()
    render(<Harness onAddNew={vi.fn()} />)
    const long = 'Longname '.repeat(30).trim()
    await user.type(screen.getByPlaceholderText('Ingredient'), long)
    const row = screen.getByRole('option', { name: `Add "${long}" as a new food` })
    expect(row.querySelector('[title]')).toHaveAttribute('title', `Add "${long}" as a new food`)
  })
})
