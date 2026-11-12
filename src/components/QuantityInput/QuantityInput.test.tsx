import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import QuantityInput from './QuantityInput'

describe('QuantityInput', () => {
  it('reports the parsed number for fraction input', () => {
    const onChange = vi.fn()
    render(<QuantityInput value={1} unit="slice" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1 1/2' } })
    expect(onChange).toHaveBeenLastCalledWith(1.5)
  })

  it('reports null and flags invalid text', () => {
    const onChange = vi.fn()
    render(<QuantityInput value={1} unit="slice" onChange={onChange} />)
    const input = screen.getByLabelText('Amount')
    fireEvent.change(input, { target: { value: 'abc' } })
    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('uses a text keyboard so "/", space and fraction glyphs can be typed on phones', () => {
    render(<QuantityInput value={1} unit="slice" onChange={() => {}} />)
    expect(screen.getByLabelText('Amount')).toHaveAttribute('inputmode', 'text')
  })

  it('reformats on blur using the unit', () => {
    render(<QuantityInput value={1} unit="slice" onChange={() => {}} />)
    const input = screen.getByLabelText('Amount') as HTMLInputElement
    fireEvent.change(input, { target: { value: '1.5' } })
    fireEvent.blur(input)
    expect(input.value).toBe('1½')
  })
})
