import { useState, useRef } from 'react'
import { AutoComplete } from 'primereact/autocomplete'
import type { AutoCompleteCompleteEvent, AutoCompleteChangeEvent, AutoCompleteSelectEvent } from 'primereact/autocomplete'
import AutocompleteStatus, { resultsMessage } from './AutocompleteStatus'
import { useActiveDescendant } from './useActiveDescendant'
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
  const containerRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState<string | null>(null)
  // Results are only announced while the list is actually showing.
  const [open, setOpen] = useState(false)
  useActiveDescendant(containerRef)

  function filterOptions(query: string): T[] {
    const q = query.trim().toLowerCase()
    return !q
      ? options.slice(0, 6)
      : options.filter((opt) => getOptionLabel(opt).toLowerCase().includes(q)).slice(0, 6)
  }

  function handleComplete(e: AutoCompleteCompleteEvent) {
    setQuery(e.query)
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
    setQuery(null)
    onChange(label)
    onSelect?.(option)
  }

  function handleChange(e: AutoCompleteChangeEvent) {
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

  const statusMessage =
    query === null ? '' : suggestions.length > 0 ? (open ? resultsMessage(suggestions.length) : '') : query.trim() ? 'No matches' : ''

  function focus() {
    (acRef.current?.getInput() as unknown as HTMLInputElement | null)?.focus?.()
  }

  return (
    <div className="autocomplete" ref={containerRef}>
      <AutoComplete
        ref={acRef}
        value={value}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        suggestions={suggestions as any[]}
        completeMethod={handleComplete}
        onChange={handleChange}
        onSelect={handleSelect}
        onFocus={handleFocus}
        onShow={() => setOpen(true)}
        onHide={() => setOpen(false)}
        onBlur={() => setQuery(null)}
        onKeyUp={(e) => { if (e.key === 'Escape') setQuery(null) }}
        itemTemplate={itemTemplate}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        delay={0}
        inputClassName={`text-input ingredient-name-input ${inputClassName ?? ''}`.trim()}
        aria-label={inputAriaLabel}
      />
      <AutocompleteStatus message={statusMessage} />
      {allowClear && !!value && !readOnly && !disabled && (
        <button
          type="button"
          className="autocomplete-clear"
          aria-label="Clear input"
          // Pointer and screen-reader-cursor only. A keyboard user clears with select-all + Delete,
          // and a Tab stop between the input and the next field is noise (#240).
          tabIndex={-1}
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onClick={() => {
            setQuery(null)
            onChange('')
            focus() // triggers handleFocus which re-opens the panel
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}
