import React, { useState, useEffect, useImperativeHandle, useRef } from 'react'

interface AutoCompleteCompleteEvent {
  query: string
}

interface AutoCompleteChangeEvent {
  value: unknown
}

interface AutoCompleteSelectEvent {
  value: unknown
}

interface AutoCompleteProps<T = unknown> {
  value?: string
  suggestions?: T[]
  completeMethod?: (e: AutoCompleteCompleteEvent) => void
  onChange?: (e: AutoCompleteChangeEvent) => void
  onSelect?: (e: AutoCompleteSelectEvent) => void
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void
  itemTemplate?: (suggestion: T, index: number) => React.ReactNode
  placeholder?: string
  inputClassName?: string
  disabled?: boolean
  readOnly?: boolean
  delay?: number
  pt?: { input?: Record<string, unknown> }
}

export const AutoComplete = React.forwardRef<
  { search: (event: unknown, query: string, source?: string | null) => void; getElement: () => HTMLSpanElement | null },
  AutoCompleteProps
>(function AutoComplete(
  {
    value = '',
    suggestions,
    completeMethod,
    onChange,
    onSelect,
    onFocus,
    itemTemplate,
    placeholder,
    inputClassName,
    disabled,
    readOnly,
    pt,
  },
  ref
) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const spanRef = useRef<HTMLSpanElement>(null)

  useImperativeHandle(ref, () => ({
    search(_event: unknown, query: string) {
      completeMethod?.({ query })
    },
    getElement() {
      return spanRef.current
    },
  }))

  useEffect(() => {
    if (suggestions && suggestions.length > 0) {
      setHighlightedIndex(-1)
    } else {
      setIsOpen(false)
    }
  }, [suggestions])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const query = e.target.value
    onChange?.({ value: query })
    completeMethod?.({ query })
  }

  function handleInputFocus(e: React.FocusEvent<HTMLInputElement>) {
    onFocus?.(e)
  }

  function handleSelectOption(option: unknown) {
    setIsOpen(false)
    setHighlightedIndex(-1)
    onSelect?.({ value: option })
    onChange?.({ value: option })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || !suggestions || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault()
        handleSelectOption(suggestions[highlightedIndex])
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setHighlightedIndex(-1)
    }
  }

  const inputId = `${pt?.input?.['id'] ?? 'mock-ac'}`

  return (
    <span ref={spanRef} className="p-autocomplete p-component p-inputwrapper">
      <input
        type="text"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        id={inputId}
        className={`p-autocomplete-input ${inputClassName ?? ''}`}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        {...(pt?.input ?? {})}
      />
      {isOpen && suggestions && suggestions.length > 0 && (
        <div className="p-autocomplete-panel p-component">
          <ul
            role="listbox"
            className="p-autocomplete-items"
            id={`${inputId}_list`}
          >
            {suggestions.map((option, index) => (
              <li
                key={index}
                role="option"
                aria-selected={index === highlightedIndex}
                className={`p-autocomplete-item${index === highlightedIndex ? ' p-focus' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelectOption(option)
                }}
                onClick={() => handleSelectOption(option)}
              >
                {itemTemplate ? itemTemplate(option, index) : String(option)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  )
})
