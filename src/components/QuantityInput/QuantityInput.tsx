'use client'

import { useState } from 'react'
import { InputText } from 'primereact/inputtext'
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
}

// Free-text amount field that accepts fractions ("1 1/2", "½") and decimals. Reports the parsed number
// on every keystroke and tidies the text (e.g. "1.5" -> "1½" for count units) on blur.
export default function QuantityInput({ value, unit, onChange, className, disabled, ariaLabel = 'Amount', id }: QuantityInputProps) {
  const [text, setText] = useState(value === null ? '' : formatQuantity(value, unit))
  const parsed = parseQuantity(text)
  // Follow a value changed from outside (food picked, sizes synced). Our own onChange echoes the parsed
  // text back, so parsed === value then and the text the user is typing is left alone.
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    if (value !== parsed) setText(value === null ? '' : formatQuantity(value, unit))
  }
  const invalid = text.trim() !== '' && parsed === null
  // Smallest value above 0 the arrows can reach (0.25 for counts, 1 for measures).
  const min = stepQuantity(null, 1, unit)

  return (
    <InputText
      value={text}
      inputMode="text"
      id={id}
      disabled={disabled}
      aria-label={ariaLabel}
      role="spinbutton"
      aria-valuemin={min ?? undefined}
      aria-valuenow={parsed ?? undefined}
      aria-valuetext={parsed === null ? undefined : formatQuantity(parsed, unit)}
      aria-invalid={invalid}
      className={`text-input ${invalid ? 'p-invalid' : ''} ${className ?? ''}`.trim()}
      onChange={(e) => {
        setText(e.target.value)
        onChange(parseQuantity(e.target.value))
      }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
        // Leave browser/OS shortcuts and IME candidate navigation alone.
        if (e.ctrlKey || e.altKey || e.metaKey || e.nativeEvent.isComposing) return
        e.preventDefault()
        const next = stepQuantity(parsed, e.key === 'ArrowUp' ? 1 : -1, unit)
        if (next === null) return
        setText(formatQuantity(next, unit))
        onChange(next)
      }}
      onBlur={() => {
        if (parsed !== null) setText(formatQuantity(parsed, unit))
      }}
    />
  )
}
