import { useMemo, useState, useRef, useId } from 'react'
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
}: AutocompleteProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const listboxId = useId()
  const blurTimeout = useRef<number>()

  const filteredOptions = useMemo(() => {
    const query = value.trim().toLowerCase()
    return !query
      ? options.slice(0, 6)
      : options
          .filter((opt) => getOptionLabel(opt).toLowerCase().includes(query))
          .slice(0, 6)
  }, [value, options, getOptionLabel])

  function handleSelect(option: T) {
    const label = getOptionLabel(option)
    onChange(label)
    onSelect?.(option)
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  function handleFocus() {
    if (blurTimeout.current) window.clearTimeout(blurTimeout.current)
    setIsOpen(true)
  }

  function handleBlur() {
    blurTimeout.current = window.setTimeout(() => setIsOpen(false), 80)
  }

  const getOptionId = (idx: number) => `${listboxId}-${idx}`
  const activeIndex = (() => {
    if (filteredOptions.length === 0) return -1
    const max = filteredOptions.length - 1
    return Math.min(Math.max(highlightedIndex, -1), max)
  })()

  return (
    <div className="autocomplete">
      <input
        type="text"
        className="text-input ingredient-name-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-label={inputAriaLabel}
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 && activeIndex < filteredOptions.length
            ? getOptionId(activeIndex)
            : undefined
        }
        readOnly={readOnly}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (!isOpen) {
              setIsOpen(true)
              setHighlightedIndex(0)
              return
            }
            setHighlightedIndex((prev) => {
              const max = filteredOptions.length - 1
              if (max < 0) return -1
              const next = Math.min(max, prev + 1)
              return next < 0 ? 0 : next
            })
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (!isOpen) {
              setIsOpen(true)
              setHighlightedIndex(filteredOptions.length - 1)
              return
            }
            setHighlightedIndex((prev) => {
              const max = filteredOptions.length - 1
              if (max < 0) return -1
              return Math.max(0, prev - 1)
            })
          } else if (e.key === 'Enter' && activeIndex >= 0 && activeIndex < filteredOptions.length) {
            e.preventDefault()
            handleSelect(filteredOptions[activeIndex])
          } else if (e.key === 'Escape') {
            setIsOpen(false)
            setHighlightedIndex(-1)
          }
        }}
      />
      {isOpen && filteredOptions.length > 0 && (
        <ul className="autocomplete-suggestions" role="listbox" id={listboxId}>
          {filteredOptions.map((option, index) => {
            const label = getOptionLabel(option)
            const meta = renderOptionMeta?.(option)
            return (
              <li
                id={getOptionId(index)}
                key={`${label}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={index === highlightedIndex ? 'is-active' : undefined}
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(option)
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <span className="suggestion-name">{label}</span>
                {meta ? <span className="suggestion-meta">{meta}</span> : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
