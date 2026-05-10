import { useState, useRef } from 'react'
import { AutoComplete } from 'primereact/autocomplete'
import type { AutoCompleteCompleteEvent, AutoCompleteChangeEvent, AutoCompleteSelectEvent } from 'primereact/autocomplete'
import './autocomplete.scss'

type AutocompleteProps<T> = {
  value: string
  options: T[]
  getOptionLabel: (option: T) => string
  onChange: (value: string) => void
  onSelect?: (option: T) => void
  placeholder?: string
  inputAriaLabel?: string
  readOnly?: boolean
  disabled?: boolean
  renderOptionMeta?: (option: T) => string | undefined
  allowClear?: boolean
  inputClassName?: string
}

export default function Autocomplete<T>({
  value,
  options,
  getOptionLabel,
  onChange,
  onSelect,
  placeholder,
  inputAriaLabel,
  readOnly,
  disabled,
  renderOptionMeta,
  allowClear = true,
  inputClassName = '',
}: AutocompleteProps<T>) {
  const [suggestions, setSuggestions] = useState<T[]>([])
  const acRef = useRef<AutoComplete>(null)
  const selectionInProgressRef = useRef(false)

  function filterOptions(query: string): T[] {
    const q = query.trim().toLowerCase()
    return !q
      ? options.slice(0, 6)
      : options.filter((opt) => getOptionLabel(opt).toLowerCase().includes(q)).slice(0, 6)
  }

  function handleComplete(e: AutoCompleteCompleteEvent) {
    setSuggestions(filterOptions(e.query))
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    // Pass null as source to bypass PrimeReact's empty-string guard so the
    // panel opens even when the input is still empty.
    acRef.current?.search(e, value)
  }

  function handleSelect(e: AutoCompleteSelectEvent) {
    const option = e.value as T
    const label = getOptionLabel(option)
    selectionInProgressRef.current = true
    onChange(label)
    onSelect?.(option)
  }

  function handleChange(e: AutoCompleteChangeEvent) {
    if (selectionInProgressRef.current) {
      selectionInProgressRef.current = false
      return
    }
    if (typeof e.value === 'string') {
      onChange(e.value)
    } else if (e.value == null) {
      onChange('')
    }
  }

  const itemTemplate = (option: T) => {
    const label = getOptionLabel(option)
    const meta = renderOptionMeta?.(option)
    return (
      <div className="autocomplete-item-content">
        <span className="suggestion-name">{label}</span>
        {meta ? <span className="suggestion-meta">{meta}</span> : null}
      </div>
    )
  }

  function focus() {
    acRef.current?.getInput()?.focus?.()
  }

  return (
    <div className="autocomplete">
      <AutoComplete
        ref={acRef}
        value={value}
        suggestions={suggestions}
        completeMethod={handleComplete}
        onChange={handleChange}
        onSelect={handleSelect}
        onFocus={handleFocus}
        itemTemplate={itemTemplate}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        delay={0}
        inputClassName={`text-input ingredient-name-input ${inputClassName}`.trim()}
        pt={{ input: { 'aria-label': inputAriaLabel } }}
      />
      {allowClear && !!value && !readOnly && !disabled && (
        <button
          type="button"
          className="autocomplete-clear"
          aria-label="Clear input"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onClick={() => {
            onChange('')
            focus()
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}
