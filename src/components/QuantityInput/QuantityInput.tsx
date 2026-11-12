'use client'

import { useState } from 'react'
import { InputText } from 'primereact/inputtext'
import { parseQuantity, formatQuantity } from '@/utils/quantity'

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

  return (
    <InputText
      value={text}
      inputMode="text"
      aria-label="Amount"
      aria-invalid={invalid}
      className={`text-input ${invalid ? 'p-invalid' : ''} ${className ?? ''}`.trim()}
      onChange={(e) => {
        setText(e.target.value)
        onChange(parseQuantity(e.target.value))
      }}
      onBlur={() => {
        if (parsed !== null) setText(formatQuantity(parsed, unit))
      }}
    />
  )
}
