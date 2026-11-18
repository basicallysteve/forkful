'use client'

import { useRef, useState } from 'react'
import { InputText } from 'primereact/inputtext'
import './quantity-input.scss'
import { parseQuantity, formatQuantity, stepQuantity } from '@/utils/quantity'

interface QuantityInputProps {
  // Parsed amount, or null while the text is empty/invalid.
  value: number | null
  unit: string
  onChange: (value: number | null) => void
  className?: string
  disabled?: boolean
  // Accessible name; defaults to "Amount". Give each box on a screen its own.
  ariaLabel?: string
  id?: string
  // Largest accepted amount; no cap when omitted. Over it is invalid while typing and clamps on blur.
  max?: number
  // Show a short visible message under the box when the amount is zero or over the max.
  showInvalidHint?: boolean
}

// Free-text amount field that accepts fractions ("1 1/2", "½") and decimals. Reports the parsed number
// on every keystroke and tidies the text (e.g. "1.5" -> "1½" for count units) on blur.
export default function QuantityInput({ value, unit, onChange, className, disabled, ariaLabel = 'Amount', id, max, showInvalidHint }: QuantityInputProps) {
  const [text, setText] = useState(value === null ? '' : formatQuantity(value, unit))
  const raw = parseQuantity(text)
  const overCap = raw !== null && max !== undefined && raw > max
  // Over the cap counts as invalid (null) while typing; blur clamps it to the cap.
  const parsed = overCap ? null : raw
  const justFocused = useRef(false)
  // Follow a value changed from outside (food picked, sizes synced). A change that lands in the render
  // right after our own onChange is the parent's echo (it may normalise, e.g. null -> 0), so the text the
  // user is typing is left alone. A parent that echoes asynchronously would overwrite mid-edit text (no caller does).
  const [emitted, setEmitted] = useState(false)
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    if (!emitted && value !== parsed) setText(value === null ? '' : formatQuantity(value, unit))
  }
  if (emitted) setEmitted(false)
  // Zero is flagged too: an amount must be above 0.
  const invalid = text.trim() !== '' && (parsed === null || parsed <= 0)
  // Smallest value above 0 the arrows can reach (0.25 for counts, 1 for measures).
  const min = stepQuantity(null, 1, unit)

  const hint = !showInvalidHint || text.trim() === '' ? null : overCap ? `Maximum is ${max}` : parsed !== null && parsed <= 0 ? 'Must be above 0' : null

  return (
    <>
    <InputText
      value={text}
      inputMode="text"
      id={id}
      disabled={disabled}
      aria-label={ariaLabel}
      role="spinbutton"
      aria-valuemin={min ?? undefined}
      aria-valuemax={max}
      aria-valuenow={parsed ?? undefined}
      aria-valuetext={parsed === null ? undefined : formatQuantity(parsed, unit)}
      aria-invalid={invalid}
      className={`text-input ${invalid ? 'p-invalid' : ''} ${className ?? ''}`.trim()}
      onChange={(e) => {
        setText(e.target.value)
        setEmitted(true)
        const next = parseQuantity(e.target.value)
        onChange(next !== null && max !== undefined && next > max ? null : next)
      }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
        // Leave browser/OS shortcuts and IME candidate navigation alone.
        if (e.ctrlKey || e.altKey || e.metaKey || e.nativeEvent.isComposing) return
        e.preventDefault()
        const next = stepQuantity(parsed, e.key === 'ArrowUp' ? 1 : -1, unit)
        if (next === null || (max !== undefined && next > max)) return
        setText(formatQuantity(next, unit))
        setEmitted(true)
        onChange(next)
      }}
      onMouseDown={() => {
        // A click inside an already-focused box (e.g. after Tab) places the caret as usual.
        justFocused.current = false
      }}
      onFocus={(e) => {
        // Typing replaces the current amount rather than appending to it.
        justFocused.current = true
        e.target.select()
      }}
      // Browsers collapse the selection on the mouseup that finishes the focusing click; keep it.
      onMouseUp={(e) => {
        if (!justFocused.current) return
        justFocused.current = false
        e.preventDefault()
      }}
      onBlur={() => {
        justFocused.current = false
        if (overCap) {
          setText(formatQuantity(max, unit))
          setEmitted(true)
          onChange(max)
        } else if (parsed !== null) setText(formatQuantity(parsed, unit))
      }}
    />
    {hint && <small className="quantity-input-hint" role="status">{hint}</small>}
    </>
  )
}
