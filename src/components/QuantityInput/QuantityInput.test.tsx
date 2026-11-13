import { useState } from 'react'
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

  describe('accessibility', () => {
    it('is a spinbutton exposing the parsed value, minimum and formatted text', () => {
      render(<QuantityInput value={1.5} unit="slice" onChange={() => {}} />)
      const input = screen.getByRole('spinbutton', { name: 'Amount' })
      expect(input).toHaveAttribute('aria-valuenow', '1.5')
      expect(input).toHaveAttribute('aria-valuemin', '0.25')
      expect(input).toHaveAttribute('aria-valuetext', '1½')
      expect(input).toHaveAttribute('aria-invalid', 'false')
    })

    it('uses a minimum of 1 for measured units', () => {
      render(<QuantityInput value={5} unit="g" onChange={() => {}} />)
      expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-valuemin', '1')
    })

    it('omits aria-valuenow and aria-valuetext when the text is invalid or empty', () => {
      render(<QuantityInput value={1} unit="slice" onChange={() => {}} />)
      const input = screen.getByRole('spinbutton')
      fireEvent.change(input, { target: { value: 'abc' } })
      expect(input).not.toHaveAttribute('aria-valuenow')
      expect(input).not.toHaveAttribute('aria-valuetext')
      expect(input).toHaveAttribute('aria-invalid', 'true')
      fireEvent.change(input, { target: { value: '' } })
      expect(input).not.toHaveAttribute('aria-valuenow')
    })

    it('updates the attributes when stepping', () => {
      render(<QuantityInput value={1} unit="slice" onChange={() => {}} />)
      const input = screen.getByRole('spinbutton')
      fireEvent.keyDown(input, { key: 'ArrowUp' })
      expect(input).toHaveAttribute('aria-valuenow', '1.25')
      expect(input).toHaveAttribute('aria-valuetext', '1¼')
    })

    it.each(['ctrlKey', 'altKey', 'metaKey'])('ignores arrows with %s held', (mod) => {
      const onChange = vi.fn()
      render(<QuantityInput value={1} unit="g" onChange={onChange} />)
      const input = screen.getByRole('spinbutton') as HTMLInputElement
      const notCancelled = fireEvent.keyDown(input, { key: 'ArrowUp', [mod]: true })
      expect(notCancelled).toBe(true)
      expect(onChange).not.toHaveBeenCalled()
      expect(input.value).toBe('1')
    })

    it('ignores arrows during IME composition', () => {
      const onChange = vi.fn()
      render(<QuantityInput value={1} unit="g" onChange={onChange} />)
      const input = screen.getByRole('spinbutton') as HTMLInputElement
      const notCancelled = fireEvent.keyDown(input, { key: 'ArrowDown', isComposing: true })
      expect(notCancelled).toBe(true)
      expect(onChange).not.toHaveBeenCalled()
      expect(input.value).toBe('1')
    })
  })
  it('can be disabled', () => {
    render(<QuantityInput value={1} unit="slice" onChange={() => {}} disabled />)
    expect(screen.getByLabelText('Amount')).toBeDisabled()
  })

  it('follows an externally changed value', () => {
    const { rerender } = render(<QuantityInput value={1} unit="slice" onChange={() => {}} />)
    const input = screen.getByLabelText('Amount') as HTMLInputElement
    rerender(<QuantityInput value={2.5} unit="slice" onChange={() => {}} />)
    expect(input.value).toBe('2½')
    rerender(<QuantityInput value={null} unit="slice" onChange={() => {}} />)
    expect(input.value).toBe('')
  })

  it('does not clobber text the user is mid-typing when the parent echoes the parsed value', () => {
    function Harness() {
      const [v, setV] = useState<number | null>(1)
      return <QuantityInput value={v} unit="slice" onChange={setV} />
    }
    render(<Harness />)
    const input = screen.getByLabelText('Amount') as HTMLInputElement
    fireEvent.change(input, { target: { value: '1.5' } })
    expect(input.value).toBe('1.5')
    fireEvent.change(input, { target: { value: '1 ' } })
    expect(input.value).toBe('1 ')
    fireEvent.change(input, { target: { value: '' } })
    expect(input.value).toBe('')
  })

  it('accepts a custom ariaLabel and id', () => {
    render(<QuantityInput value={1} unit="slice" onChange={() => {}} ariaLabel="Current Size" id="current-size" />)
    const input = screen.getByLabelText('Current Size')
    expect(input).toHaveAttribute('id', 'current-size')
    expect(input).toHaveAttribute('role', 'spinbutton')
  })
})
