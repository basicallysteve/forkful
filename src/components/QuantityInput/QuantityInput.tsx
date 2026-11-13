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
}

// Free-text amount field that accepts fractions ("1 1/2", "½") and decimals. Reports the parsed number
// on every keystroke and tidies the text (e.g. "1.5" -> "1½" for count units) on blur.
export default function QuantityInput({ value, unit, onChange, className }: QuantityInputProps) {
  const [text, setText] = useState(value === null ? '' : formatQuantity(value, unit))
  const parsed = parseQuantity(text)
  const invalid = text.trim() !== '' && parsed === null
  // Smallest value above 0 the arrows can reach (0.25 for counts, 1 for measures).
  const min = stepQuantity(null, 1, unit)

  return (
    <InputText
      value={text}
      inputMode="text"
      aria-label="Amount"
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
