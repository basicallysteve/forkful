'use client'

import { useRef, useState } from 'react'
import { AutoComplete } from 'primereact/autocomplete'
import type { AutoCompleteCompleteEvent, AutoCompleteSelectEvent, AutoCompleteChangeEvent } from 'primereact/autocomplete'
import { apiFetchPantryItems } from '@/lib/api/pantry'
import type { PantryItem } from '@/types/PantryItem'
import './pantry-search.scss'

type SuggestionGroup = {
  label: string
  items: PantryItem[]
}

function itemDisplayName(item: PantryItem): string {
  if (item.sourceType === 'food') return item.food?.name ?? 'Pantry item'
  if (item.sourceType === 'product') return item.product?.name ?? 'Pantry item'
  return item.recipeNameSnapshot ?? 'Prepared meal'
}

function itemMeta(item: PantryItem): string {
  const size = `${item.currentSize.size} ${item.currentSize.unit ?? ''}`
  if (item.expirationDate) {
    const exp = item.expirationDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `${size} · expires ${exp}`
  }
  return size
}

interface PantrySearchProps {
  onSelect: (item: PantryItem) => void
  sourceType?: 'food' | 'product' | 'recipe'
  excludeIds?: number[]
  placeholder?: string
}

export default function PantrySearch({ onSelect, sourceType, excludeIds = [], placeholder }: PantrySearchProps) {
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<SuggestionGroup[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestQueryRef = useRef<string>('')
  const acRef = useRef<AutoComplete>(null)

  async function handleComplete(e: AutoCompleteCompleteEvent) {
    const query = e.query.trim()
    latestQueryRef.current = query

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (latestQueryRef.current !== query) return
      try {
        const items = await apiFetchPantryItems({ search: query || undefined })
        if (latestQueryRef.current !== query) return

        setSuggestions(filtered.length > 0 ? [{ label: 'Your pantry', items }] : [])
      } catch {
        setSuggestions([])
      }
    }, 300)
  }

  function handleSelect(e: AutoCompleteSelectEvent) {
    const item = e.value as PantryItem
    setInputValue(itemDisplayName(item))
    onSelect(item)
  }

  function handleChange(e: AutoCompleteChangeEvent<PantryItem>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = e.value as any
    if (typeof val === 'string') {
      setInputValue(val)
      if (!val.trim()) setSuggestions([])
    }
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    acRef.current?.search(e, inputValue)
  }

  const itemTemplate = (item: PantryItem) => (
    <div className="pantry-search-item">
      <span className="pantry-search-item-name">{itemDisplayName(item)}</span>
      <span className="pantry-search-item-meta">{itemMeta(item)}</span>
    </div>
  )

  const groupTemplate = (group: SuggestionGroup) => (
    <div className="pantry-search-group-label">{group.label}</div>
  )

  return (
    <div className="pantry-search">
      <AutoComplete
        ref={acRef}
        value={inputValue}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        suggestions={suggestions as any[]}
        completeMethod={handleComplete}
        onSelect={handleSelect}
        onFocus={handleFocus}
        onChange={handleChange}
        field="id"
        optionGroupLabel="label"
        optionGroupChildren="items"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        optionGroupTemplate={groupTemplate as any}
        itemTemplate={itemTemplate}
        placeholder={placeholder ?? 'Search your pantry…'}
        delay={0}
        inputClassName="text-input"
      />
    </div>
  )
}
