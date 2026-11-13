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

  it('ArrowUp / ArrowDown step the value like a number input', () => {
    const onChange = vi.fn()
    render(<QuantityInput value={1} unit="slice" onChange={onChange} />)
    const input = screen.getByLabelText('Amount') as HTMLInputElement
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(1.25)
    expect(input.value).toBe('1¼')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(onChange).toHaveBeenLastCalledWith(0.75)
    expect(input.value).toBe('¾')
  })

  it('steps g by 1 with decimal display and no float noise', () => {
    const onChange = vi.fn()
    render(<QuantityInput value={0.3} unit="g" onChange={onChange} />)
    const input = screen.getByLabelText('Amount') as HTMLInputElement
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(1)
    expect(input.value).toBe('1')
  })

  it('starts from 0 on empty or invalid text', () => {
    const onChange = vi.fn()
    render(<QuantityInput value={null} unit="g" onChange={onChange} />)
    const input = screen.getByLabelText('Amount') as HTMLInputElement
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(1)
    fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(1)
  })

  it('ArrowDown at the minimum stays put', () => {
    const onChange = vi.fn()
    render(<QuantityInput value={1} unit="g" onChange={onChange} />)
    const input = screen.getByLabelText('Amount') as HTMLInputElement
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(onChange).not.toHaveBeenCalled()
    expect(input.value).toBe('1')
  })

  it('prevents the default so the caret does not jump', () => {
    render(<QuantityInput value={1} unit="g" onChange={() => {}} />)
    const notCancelled = fireEvent.keyDown(screen.getByLabelText('Amount'), { key: 'ArrowUp' })
    expect(notCancelled).toBe(false)
  })
})
