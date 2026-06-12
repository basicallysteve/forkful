import React, { useState, useImperativeHandle, useRef } from 'react'

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
  optionGroupLabel?: string
  optionGroupChildren?: string
  optionGroupTemplate?: (group: T) => React.ReactNode
  placeholder?: string
  inputClassName?: string
  disabled?: boolean
  readOnly?: boolean
  delay?: number
  pt?: { input?: Record<string, unknown> }
}

/** Flatten grouped suggestions into a flat list of { group, item, globalIndex } entries. */
function flattenGroups<T>(
  suggestions: T[],
  groupChildrenKey: string,
): { item: unknown; globalIndex: number }[] {
  const flat: { item: unknown; globalIndex: number }[] = []
  let idx = 0
  for (const group of suggestions) {
    const children = (group as Record<string, unknown>)[groupChildrenKey]
    if (Array.isArray(children)) {
      for (const child of children) {
        flat.push({ item: child, globalIndex: idx++ })
      }
    }
  }
  return flat
}

export const AutoComplete = React.forwardRef<
  { search: (event: unknown, query: string, source?: string | null) => void; getElement: () => HTMLSpanElement | null; getInput: () => HTMLInputElement | null },
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
    optionGroupLabel,
    optionGroupChildren,
    optionGroupTemplate,
    placeholder,
    inputClassName,
    disabled,
    readOnly,
    pt,
  },
  ref
) {
  const [panelForcedClosed, setPanelForcedClosed] = useState(false)
  const isOpen = !!(suggestions && suggestions.length > 0) && !panelForcedClosed
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const spanRef = useRef<HTMLSpanElement>(null)

  const isGrouped = !!(optionGroupChildren && suggestions && suggestions.length > 0)
  const flatItems = isGrouped
    ? flattenGroups(suggestions!, optionGroupChildren!)
    : (suggestions ?? []).map((item, idx) => ({ item, globalIndex: idx }))

  useImperativeHandle(ref, () => ({
    search(_event: unknown, query: string) {
      setPanelForcedClosed(false)
      completeMethod?.({ query })
    },
    getElement() {
      return spanRef.current
    },
    getInput() {
      return spanRef.current?.querySelector('input') ?? null
    },
  }))

  function handleInputFocus(e: React.FocusEvent<HTMLInputElement>) {
      setPanelForcedClosed(false)
      setHighlightedIndex(-1)
      onFocus?.(e)
  }

  function handleSelectOption(option: unknown) {
    setPanelForcedClosed(true)
    setHighlightedIndex(-1)
    onSelect?.({ value: option })
    onChange?.({ value: option })
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const query = e.target.value
    setPanelForcedClosed(false)
    onChange?.({ value: query })
    completeMethod?.({ query })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || flatItems.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => Math.min(prev + 1, flatItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < flatItems.length) {
        e.preventDefault()
        handleSelectOption(flatItems[highlightedIndex].item)
      }
    } else if (e.key === 'Escape') {
      setPanelForcedClosed(true)
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
      {isOpen && (
        <div className="p-autocomplete-panel p-component">
          <ul
            role="listbox"
            className="p-autocomplete-items"
            id={`${inputId}_list`}
          >
            {isGrouped
              ? suggestions!.map((group, groupIdx) => {
                  const groupLabel = optionGroupLabel
                    ? (group as Record<string, unknown>)[optionGroupLabel]
                    : null
                  const children = optionGroupChildren
                    ? (group as Record<string, unknown>)[optionGroupChildren]
                    : []
                  return (
                    <React.Fragment key={groupIdx}>
                      {optionGroupTemplate ? (
                        <li role="presentation" className="p-autocomplete-item-group">
                          {optionGroupTemplate(group)}
                        </li>
                      ) : groupLabel ? (
                        <li role="presentation" className="p-autocomplete-item-group">
                          {String(groupLabel)}
                        </li>
                      ) : null}
                      {Array.isArray(children) &&
                        children.map((child: unknown, childIdx: number) => {
                          const globalIdx = flatItems.findIndex(f => f.item === child)
                          return (
                            <li
                              key={childIdx}
                              role="option"
                              aria-selected={globalIdx === highlightedIndex}
                              className={`p-autocomplete-item${globalIdx === highlightedIndex ? ' p-focus' : ''}`}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                handleSelectOption(child)
                              }}
                              onClick={() => handleSelectOption(child)}
                            >
                              {itemTemplate
                                ? itemTemplate(child as never, childIdx)
                                : String(child)}
                            </li>
                          )
                        })}
                    </React.Fragment>
                  )
                })
              : flatItems.map(({ item, globalIndex }) => (
                  <li
                    key={globalIndex}
                    role="option"
                    aria-selected={globalIndex === highlightedIndex}
                    className={`p-autocomplete-item${globalIndex === highlightedIndex ? ' p-focus' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSelectOption(item)
                    }}
                    onClick={() => handleSelectOption(item)}
                  >
                    {itemTemplate ? itemTemplate(item as never, globalIndex) : String(item)}
                  </li>
                ))}
          </ul>
        </div>
      )}
    </span>
  )
})
