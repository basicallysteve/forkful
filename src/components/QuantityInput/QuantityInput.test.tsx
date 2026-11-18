import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuantityInput from './QuantityInput'
import { MAX_QUANTITY } from '@/utils/quantity'

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
  describe('replace-on-focus and limits (#247)', () => {
    function Harness({ start = 0, unit = 'g', spy }: { start?: number | null; unit?: string; spy?: (v: number | null) => void }) {
      const [v, setV] = useState<number | null>(start)
      return <QuantityInput value={v} unit={unit} onChange={(n) => { setV(n); spy?.(n) }} />
    }

    it('typing over the default value replaces it instead of appending', async () => {
      const user = userEvent.setup()
      const spy = vi.fn()
      render(<Harness start={0} spy={spy} />)
      const input = screen.getByLabelText('Amount') as HTMLInputElement
      await user.click(input)
      await user.keyboard('100')
      expect(input.value).toBe('100')
      expect(spy).toHaveBeenLastCalledWith(100)
    })

    it('tabbing into the box selects its text so the first key replaces it', async () => {
      const user = userEvent.setup()
      render(<Harness start={12} />)
      const input = screen.getByLabelText('Amount') as HTMLInputElement
      await user.tab()
      expect(input).toHaveFocus()
      expect(input.selectionStart).toBe(0)
      expect(input.selectionEnd).toBe(2)
    })

    it('a blank box reports null and stays blank (no snap to 0)', async () => {
      const user = userEvent.setup()
      const spy = vi.fn()
      render(<Harness start={5} spy={spy} />)
      const input = screen.getByLabelText('Amount') as HTMLInputElement
      await user.click(input)
      await user.keyboard('{Backspace}')
      expect(spy).toHaveBeenLastCalledWith(null)
      await user.tab()
      expect(input.value).toBe('')
    })

    it('flags zero as invalid', () => {
      render(<QuantityInput value={1} unit="g" onChange={() => {}} />)
      const input = screen.getByLabelText('Amount')
      fireEvent.change(input, { target: { value: '0' } })
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('rejects negatives and flags them invalid', () => {
      const onChange = vi.fn()
      render(<QuantityInput value={1} unit="g" onChange={onChange} />)
      const input = screen.getByLabelText('Amount')
      fireEvent.change(input, { target: { value: '-3' } })
      expect(onChange).toHaveBeenLastCalledWith(null)
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('treats a value over 9999 as invalid while typing (reports null, never the huge number)', () => {
      const onChange = vi.fn()
      render(<QuantityInput value={1} unit="g" onChange={onChange} max={MAX_QUANTITY} />)
      const input = screen.getByLabelText('Amount')
      fireEvent.change(input, { target: { value: '999999999' } })
      expect(onChange).toHaveBeenLastCalledWith(null)
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('allows exactly 9999', () => {
      const onChange = vi.fn()
      render(<QuantityInput value={1} unit="g" onChange={onChange} max={MAX_QUANTITY} />)
      const input = screen.getByLabelText('Amount')
      fireEvent.change(input, { target: { value: '9999' } })
      expect(onChange).toHaveBeenLastCalledWith(9999)
      expect(input).toHaveAttribute('aria-invalid', 'false')
    })

    it('clamps an over-the-cap value to 9999 on blur and reports it', () => {
      const onChange = vi.fn()
      render(<QuantityInput value={1} unit="g" onChange={onChange} max={MAX_QUANTITY} />)
      const input = screen.getByLabelText('Amount') as HTMLInputElement
      fireEvent.change(input, { target: { value: '999999999' } })
      fireEvent.blur(input)
      expect(input.value).toBe('9999')
      expect(onChange).toHaveBeenLastCalledWith(9999)
      expect(input).toHaveAttribute('aria-invalid', 'false')
    })

    it('exposes the maximum to assistive tech', () => {
      render(<QuantityInput value={1} unit="g" onChange={() => {}} max={MAX_QUANTITY} />)
      expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-valuemax', '9999')
    })

    it('ArrowUp stops at the cap', () => {
      const onChange = vi.fn()
      render(<QuantityInput value={9999} unit="g" onChange={onChange} max={MAX_QUANTITY} />)
      fireEvent.keyDown(screen.getByLabelText('Amount'), { key: 'ArrowUp' })
      expect(onChange).not.toHaveBeenCalled()
    })
  })
  describe('review round 1 (#247)', () => {
    it('has no cap by default: 20000 stays 20000, also after blur', () => {
      const onChange = vi.fn()
      render(<QuantityInput value={1} unit="g" onChange={onChange} />)
      const input = screen.getByLabelText('Amount') as HTMLInputElement
      fireEvent.change(input, { target: { value: '20000' } })
      expect(onChange).toHaveBeenLastCalledWith(20000)
      expect(input).toHaveAttribute('aria-invalid', 'false')
      fireEvent.blur(input)
      expect(input.value).toBe('20000')
      expect(onChange).toHaveBeenLastCalledWith(20000)
      expect(input).not.toHaveAttribute('aria-valuemax')
    })

    it('ArrowUp past 9999 works when there is no cap', () => {
      const onChange = vi.fn()
      render(<QuantityInput value={9999} unit="g" onChange={onChange} />)
      fireEvent.keyDown(screen.getByLabelText('Amount'), { key: 'ArrowUp' })
      expect(onChange).toHaveBeenLastCalledWith(10000)
    })

    it('a custom max is honoured and exposed', () => {
      const onChange = vi.fn()
      render(<QuantityInput value={1} unit="g" onChange={onChange} max={50} />)
      const input = screen.getByLabelText('Amount') as HTMLInputElement
      expect(input).toHaveAttribute('aria-valuemax', '50')
      fireEvent.change(input, { target: { value: '51' } })
      expect(onChange).toHaveBeenLastCalledWith(null)
      fireEvent.blur(input)
      expect(input.value).toBe('50')
    })

    it('after a Tab focus, a later mouse click is left alone so a caret can be placed', () => {
      render(<QuantityInput value={12} unit="g" onChange={() => {}} />)
      const input = screen.getByLabelText('Amount')
      fireEvent.focus(input) // keyboard focus: no mousedown first
      fireEvent.mouseDown(input) // the user now clicks inside the box
      expect(fireEvent.mouseUp(input)).toBe(true) // not cancelled, so the caret lands where clicked
    })

    it('a focusing mouse click keeps the select-all (mouseup is cancelled once)', () => {
      render(<QuantityInput value={12} unit="g" onChange={() => {}} />)
      const input = screen.getByLabelText('Amount')
      fireEvent.mouseDown(input)
      fireEvent.focus(input)
      expect(fireEvent.mouseUp(input)).toBe(false)
      fireEvent.mouseDown(input)
      expect(fireEvent.mouseUp(input)).toBe(true)
    })

    it('explains an invalid amount visibly, not by colour alone', () => {
      render(<QuantityInput value={1} unit="g" onChange={() => {}} max={9999} showInvalidHint />)
      const input = screen.getByLabelText('Amount')
      expect(screen.queryByText(/Maximum is|above 0/)).not.toBeInTheDocument()
      fireEvent.change(input, { target: { value: '0' } })
      expect(input).toHaveClass('p-invalid')
      expect(screen.getByText('Must be above 0')).toBeVisible()
      fireEvent.change(input, { target: { value: '999999999' } })
      expect(screen.getByText('Maximum is 9999')).toBeVisible()
      fireEvent.change(input, { target: { value: '5' } })
      expect(screen.queryByText(/Maximum is|above 0/)).not.toBeInTheDocument()
    })

    it('shows no hint unless asked (Pantry and Log keep their look)', () => {
      render(<QuantityInput value={1} unit="g" onChange={() => {}} />)
      fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '0' } })
      expect(screen.queryByText('Must be above 0')).not.toBeInTheDocument()
    })
  })

  describe('review round 2 (#247)', () => {
    it('links the visible hint to the input with aria-describedby and keeps role=status', () => {
      render(<QuantityInput value={1} unit="g" onChange={() => {}} max={9999} showInvalidHint />)
      const input = screen.getByLabelText('Amount')
      expect(input).not.toHaveAttribute('aria-describedby')
      fireEvent.change(input, { target: { value: '999999999' } })
      const hint = screen.getByRole('status')
      expect(hint).toHaveTextContent('Maximum is 9999')
      expect(hint.id).not.toBe('')
      expect(input).toHaveAttribute('aria-describedby', hint.id)
      fireEvent.change(input, { target: { value: '5' } })
      expect(input).not.toHaveAttribute('aria-describedby')
    })

    it('gives two boxes on one screen different hint ids', () => {
      render(
        <>
          <QuantityInput value={0} unit="g" onChange={() => {}} ariaLabel="A" showInvalidHint />
          <QuantityInput value={0} unit="g" onChange={() => {}} ariaLabel="B" showInvalidHint />
        </>,
      )
      const [a, b] = screen.getAllByRole('status')
      expect(a.id).not.toBe(b.id)
    })
  })
})
