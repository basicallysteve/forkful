import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import Autocomplete from './Autocomplete'

const sampleOptions = ['Apple', 'Banana', 'Blueberry', 'Avocado', 'Apricot', 'Blackberry']

type ObjectOption = { id: number; name: string; calories: number }
const objectOptions: ObjectOption[] = [
  { id: 1, name: 'Chicken', calories: 165 },
  { id: 2, name: 'Broccoli', calories: 55 },
  { id: 3, name: 'Brown Rice', calories: 216 },
]

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
      allowClear
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

  it('shows at most 6 options on focus', async () => {
    const user = userEvent.setup()
    render(<AutocompleteHarness options={[...sampleOptions, 'Cherry', 'Date']} />)

    const input = screen.getByPlaceholderText('Ingredient name')
    await user.click(input)

    expect(screen.getAllByRole('option')).toHaveLength(6)
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
    fireEvent.click(option)

    expect(onSelect).toHaveBeenCalledWith('Avocado')
    expect((input as HTMLInputElement).value).toBe('Avocado')
  })

  it('clears the input via the clear button', async () => {
    const user = userEvent.setup()
    render(<AutocompleteHarness />)

    const input = screen.getByPlaceholderText('Ingredient name')
    await user.type(input, 'Apple')

    const clearButton = screen.getByRole('button', { name: /clear input/i })
    await user.click(clearButton)

    expect((input as HTMLInputElement).value).toBe('')
  })

  it('does not render clear button when value is empty', () => {
    render(<AutocompleteHarness />)
    expect(screen.queryByRole('button', { name: /clear input/i })).not.toBeInTheDocument()
  })

  it('does not render clear button when allowClear is false', async () => {
    const user = userEvent.setup()
    render(
      <Autocomplete
        value=""
        options={sampleOptions}
        getOptionLabel={(opt) => opt}
        onChange={vi.fn()}
        allowClear={false}
      />,
    )
    const input = screen.getByRole('combobox')
    await user.type(input, 'Apple')
    expect(screen.queryByRole('button', { name: /clear input/i })).not.toBeInTheDocument()
  })

  it('does not show suggestions panel when disabled', async () => {
    const user = userEvent.setup()
    render(
      <Autocomplete
        value=""
        options={sampleOptions}
        getOptionLabel={(opt) => opt}
        onChange={vi.fn()}
        disabled
      />,
    )
    const input = screen.getByRole('combobox')
    await user.click(input)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('renders option meta when renderOptionMeta is provided', async () => {
    const user = userEvent.setup()
    render(
      <Autocomplete
        value=""
        options={objectOptions}
        getOptionLabel={(opt) => opt.name}
        renderOptionMeta={(opt) => `${opt.calories} cal`}
        onChange={vi.fn()}
        placeholder="Search food"
      />,
    )

    const input = screen.getByPlaceholderText('Search food')
    await user.click(input)

    expect(screen.getByText('165 cal')).toBeInTheDocument()
    expect(screen.getByText('55 cal')).toBeInTheDocument()
  })

  it('calls onSelect with the full option object for object options', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <Autocomplete
        value=""
        options={objectOptions}
        getOptionLabel={(opt) => opt.name}
        onChange={vi.fn()}
        onSelect={onSelect}
        placeholder="Search food"
      />,
    )

    const input = screen.getByPlaceholderText('Search food')
    await user.click(input)
    fireEvent.click(screen.getByRole('option', { name: /broccoli/i }))

    expect(onSelect).toHaveBeenCalledWith(objectOptions[1])
  })

  it('calls onChange on each keystroke with the accumulated value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    function TypeTestHarness() {
      const [val, setVal] = useState('')
      return (
        <Autocomplete
          value={val}
          options={sampleOptions}
          getOptionLabel={(opt) => opt}
          onChange={(v) => {
            setVal(v)
            onChange(v)
          }}
          placeholder="Ingredient name"
        />
      )
    }
    render(<TypeTestHarness />)

    const input = screen.getByPlaceholderText('Ingredient name')
    await user.type(input, 'App')

    expect(onChange).toHaveBeenCalledWith('A')
    expect(onChange).toHaveBeenCalledWith('Ap')
    expect(onChange).toHaveBeenCalledWith('App')
  })
})
