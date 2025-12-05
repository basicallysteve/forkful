import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import Autocomplete from './Autocomplete'

const sampleOptions = ['Apple', 'Banana', 'Blueberry', 'Avocado', 'Apricot', 'Blackberry']

function AutocompleteHarness({
  options = sampleOptions,
  onSelect = vi.fn(),
  onChange = vi.fn(),
}: {
  options?: string[]
  onSelect?: (option: string) => void
  onChange?: (value: string) => void
}) {
  const [value, setValue] = useState('')

  return (
    <Autocomplete
      value={value}
      options={options}
      getOptionLabel={(opt) => opt}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
      onSelect={onSelect}
      placeholder="Ingredient name"
    />
  )
}

describe('Autocomplete component', () => {
  it('opens suggestions on focus and shows default options', async () => {
    const user = userEvent.setup()
    render(<AutocompleteHarness />)

    const input = screen.getByPlaceholderText('Ingredient name')
    await user.click(input)

    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /apple/i })).toBeInTheDocument()
  })

  it('filters suggestions as the user types', async () => {
    const user = userEvent.setup()
    render(<AutocompleteHarness />)

    const input = screen.getByPlaceholderText('Ingredient name')
    await user.type(input, 'blu')

    expect(screen.getByRole('option', { name: /blueberry/i })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /banana/i })).not.toBeInTheDocument()
  })

  it('supports keyboard navigation and selection', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<AutocompleteHarness onSelect={onSelect} />)

    const input = screen.getByPlaceholderText('Ingredient name')
    await user.click(input)
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    expect(onSelect).toHaveBeenCalledWith('Banana')
    expect((input as HTMLInputElement).value).toBe('Banana')
  })

  it('closes suggestions on Escape', async () => {
    const user = userEvent.setup()
    render(<AutocompleteHarness />)

    const input = screen.getByPlaceholderText('Ingredient name')
    await user.click(input)
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('selects with mouse click', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<AutocompleteHarness onSelect={onSelect} />)

    const input = screen.getByPlaceholderText('Ingredient name')
    await user.click(input)

    const option = screen.getByRole('option', { name: /avocado/i })
    await user.click(option)

    expect(onSelect).toHaveBeenCalledWith('Avocado')
    expect((input as HTMLInputElement).value).toBe('Avocado')
  })
})
