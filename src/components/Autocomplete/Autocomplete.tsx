import { useState, useRef } from 'react'
import { AutoComplete } from 'primereact/autocomplete'
import type { AutoCompleteCompleteEvent, AutoCompleteChangeEvent, AutoCompleteSelectEvent } from 'primereact/autocomplete'
import AutocompleteStatus, { resultsMessage } from './AutocompleteStatus'
import { useActiveDescendant } from './useActiveDescendant'
import { useAutocompleteList } from './useAutocompleteList'
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
  /**
   * Opt-in "add new" row. When set, a final suggestion (`addNewLabel(typed text)`) appears while the typed
   * text matches no option exactly (case-insensitive). Choosing it calls `onAddNew(typed text)`; the caller
   * decides what that means (and omits the prop when adding isn't allowed, e.g. signed out).
   */
  onAddNew?: (name: string) => void
  addNewLabel?: (name: string) => string
}

/** Synthetic suggestion standing for the add-new row. Never reaches `onSelect`. */
type AddNewItem = { addNew: true; name: string }
const isAddNew = (x: unknown): x is AddNewItem =>
  typeof x === 'object' && x !== null && (x as AddNewItem).addNew === true

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
  onAddNew,
  addNewLabel = (name) => `Add "${name}" as a new food`,
}: AutocompleteProps<T>) {
  const [suggestions, setSuggestions] = useState<(T | AddNewItem)[]>([])
  const acRef = useRef<AutoComplete>(null)
  const selectionInProgressRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState<string | null>(null)
  // Results are only announced while the list is actually showing.
  const { open, listProps } = useAutocompleteList()
  useActiveDescendant(containerRef)

  function filterOptions(query: string): (T | AddNewItem)[] {
    const q = query.trim().toLowerCase()
    const matches = !q
      ? options.slice(0, 6)
      : options.filter((opt) => getOptionLabel(opt).toLowerCase().includes(q)).slice(0, 6)
    // The add row is last so it stays put, and only appears on a true miss (no exact name).
    const exact = options.some((opt) => getOptionLabel(opt).trim().toLowerCase() === q)
    if (!onAddNew || !q || exact) return matches
    return [...matches, { addNew: true, name: query.trim() }]
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
    if (isAddNew(e.value)) {
      // Keep the typed text; the caller opens its add flow.
      setQuery(null)
      onAddNew?.(e.value.name)
      return
    }
    const option = e.value as T
    const label = getOptionLabel(option)
    selectionInProgressRef.current = true
    setQuery(null)
    onChange(label)
    onSelect?.(option)
  }

  function handleChange(e: AutoCompleteChangeEvent) {
    if (isAddNew(e.value)) return
    if (typeof e.value === 'string') {
      onChange(e.value)
    } else if (e.value == null) {
      onChange('')
    }
  }

  const itemTemplate = (option: T | AddNewItem) => {
    if (isAddNew(option)) {
      return (
        <div className="autocomplete-item-content autocomplete-item-content--add">
          <span className="suggestion-name">{addNewLabel(option.name)}</span>
        </div>
      )
    }
    const label = getOptionLabel(option)
    const meta = renderOptionMeta?.(option)
    return (
      <div className="autocomplete-item-content">
        <span className="suggestion-name">{label}</span>
        {meta ? <span className="suggestion-meta">{meta}</span> : null}
      </div>
    )
  }

  const matchCount = suggestions.filter((o) => !isAddNew(o)).length
  const hasAddRow = suggestions.some(isAddNew)
  const statusMessage =
    query === null ? '' : matchCount > 0 ? (open ? resultsMessage(matchCount) : '') : query.trim() ? (hasAddRow ? 'No matches. Add as new food is available' : 'No matches') : ''

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
        {...listProps}
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
