import { describe, it, expect } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import Autocomplete from './Autocomplete'

const options = ['Apple', 'Banana', 'Blueberry', 'Avocado', 'Apricot', 'Blackberry']

function Harness({ list = options }: { list?: string[] }) {
  const [value, setValue] = useState('')
  return (
    <Autocomplete
      value={value}
      options={list}
      getOptionLabel={(o) => o}
      onChange={setValue}
      placeholder="Ingredient name"
      inputAriaLabel="Ingredient"
    />
  )
}

describe('Autocomplete accessibility', () => {
  it('gives the input an accessible name from inputAriaLabel', () => {
    render(<Harness />)
    expect(screen.getByRole('combobox', { name: 'Ingredient' })).toBeInTheDocument()
  })

  it('announces the result count in a polite live region', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    await user.type(screen.getByRole('combobox'), 'ap')
    expect(status).toHaveTextContent('2 results')
  })

  it('uses the singular for one result', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByRole('combobox'), 'avo')
    expect(screen.getByRole('status')).toHaveTextContent('1 result')
    expect(screen.getByRole('status')).not.toHaveTextContent('1 results')
  })

  it('announces No matches when nothing fits the query', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByRole('combobox'), 'zzz')
    expect(screen.getByRole('status')).toHaveTextContent('No matches')
  })

  it('has exactly one live region', () => {
    render(<Harness />)
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('points aria-activedescendant at the highlighted option and clears it on Escape', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = screen.getByRole('combobox')
    await user.click(input)
    expect(input).not.toHaveAttribute('aria-activedescendant')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'))
    const first = document.getElementById(input.getAttribute('aria-activedescendant')!)
    expect(first).toHaveAttribute('role', 'option')
    expect(first).toHaveTextContent('Apple')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    await waitFor(() => {
      const el = document.getElementById(input.getAttribute('aria-activedescendant') ?? '')
      expect(el).toHaveTextContent('Banana')
    })

    fireEvent.keyDown(input, { key: 'Escape' })
    await waitFor(() => expect(input).not.toHaveAttribute('aria-activedescendant'))
  })

  it('keeps the clear button out of the tab order but labelled', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByRole('combobox'), 'ap')
    const clear = screen.getByRole('button', { name: 'Clear input' })
    expect(clear).toHaveAttribute('tabindex', '-1')
    await user.tab()
    expect(clear).not.toHaveFocus()
  })

  describe('status goes quiet once the list is closed', () => {
    it('on Escape', async () => {
      const user = userEvent.setup()
      render(<Harness />)
      await user.type(screen.getByRole('combobox'), 'ap')
      expect(screen.getByRole('status')).toHaveTextContent('2 results')
      await user.keyboard('{Escape}')
      expect(screen.getByRole('status')).toBeEmptyDOMElement()
    })

    it('on blur', async () => {
      const user = userEvent.setup()
      render(<Harness />)
      await user.type(screen.getByRole('combobox'), 'ap')
      await user.tab()
      expect(screen.getByRole('status')).toBeEmptyDOMElement()
    })

    it('on selecting an option', async () => {
      const user = userEvent.setup()
      render(<Harness />)
      await user.type(screen.getByRole('combobox'), 'ap')
      await user.click(screen.getByRole('option', { name: /Apple/ }))
      expect(screen.getByRole('status')).toBeEmptyDOMElement()
    })

    it('on clearing with the x', async () => {
      const user = userEvent.setup()
      render(<Harness />)
      await user.type(screen.getByRole('combobox'), 'zzz')
      expect(screen.getByRole('status')).toHaveTextContent('No matches')
      await user.click(screen.getByRole('button', { name: 'Clear input' }))
      expect(screen.getByRole('status')).not.toHaveTextContent('No matches')
    })

    it('and announces again when the user types again', async () => {
      const user = userEvent.setup()
      render(<Harness />)
      await user.type(screen.getByRole('combobox'), 'ap')
      await user.keyboard('{Escape}')
      await user.type(screen.getByRole('combobox'), 'p')
      expect(screen.getByRole('status')).toHaveTextContent(/result/)
    })
  })
})
