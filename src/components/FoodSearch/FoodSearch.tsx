'use client'

import { useRef, useState, useEffect } from 'react'
import { AutoComplete } from 'primereact/autocomplete'
import type { AutoCompleteCompleteEvent, AutoCompleteSelectEvent, AutoCompleteChangeEvent } from 'primereact/autocomplete'
import { apiFetchFoods, apiCreateFood } from '@/lib/api/foods'
import { apiSearchOpenFoodFacts, mapOFFProductToFood } from '@/lib/api/openFoodFacts'
import { mapUSDAFoodToFood } from '@/lib/usda'
import type { Food } from '@/types/Food'
import type { USDAFoodItem } from '@/lib/usda'
import type { OFFProduct } from '@/types/OpenFoodFacts'
import './food-search.scss'

type SuggestionGroup = {
  label: string
  items: SuggestionItem[]
}

type SuggestionItem =
  | { kind: 'local'; food: Food }
  | { kind: 'usda'; item: USDAFoodItem }
  | { kind: 'off'; product: OFFProduct }

function itemName(s: SuggestionItem): string {
  if (s.kind === 'local') return s.food.name
  if (s.kind === 'usda') return s.item.description
  return s.product.product_name
}

function itemMacros(s: SuggestionItem): string {
  if (s.kind === 'local') {
    return `${s.food.calories} cal · P ${s.food.protein}g · C ${s.food.carbs}g · F ${s.food.fat}g`
  }
  if (s.kind === 'usda') {
    const f = mapUSDAFoodToFood(s.item)
    return `${f.calories} cal · P ${f.protein}g · C ${f.carbs}g · F ${f.fat}g`
  }
  const f = mapOFFProductToFood(s.product)
  return `${f.calories} cal · P ${f.protein}g · C ${f.carbs}g · F ${f.fat}g`
}

interface FoodSearchProps {
  value: string
  localFoods: Food[]
  onChange: (food: Food) => void
  placeholder?: string
  inputAriaLabel?: string
}

export default function FoodSearch({ value, localFoods, onChange, placeholder, inputAriaLabel }: FoodSearchProps) {
  const [inputValue, setInputValue] = useState(value)
  const [suggestions, setSuggestions] = useState<SuggestionGroup[]>([])
  const [importing, setImporting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const acRef = useRef<AutoComplete>(null)

  // Sync input text when the parent's committed selection changes (e.g. different
  // ingredient row is rendered, or a food was just selected and confirmed).
  useEffect(() => {
    setInputValue(value)
  }, [value])

  async function handleComplete(e: AutoCompleteCompleteEvent) {
    const query = e.query.trim()
    if (!query) {
      setSuggestions([])
      return
    }

    // Immediate: local foods
    const localMatches = localFoods
      .filter(f => f.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 6)
    setSuggestions([
      ...(localMatches.length > 0 ? [{ label: 'In your library', items: localMatches.map(f => ({ kind: 'local' as const, food: f })) }] : []),
    ])

    // Debounced: local DB + USDA + OFF all fire in parallel
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const [localResult, usdaResult, offResult] = await Promise.allSettled([
          apiFetchFoods({ search: query }),
          fetch(`/api/usda/search?q=${encodeURIComponent(query)}&type=foods`).then(r => r.ok ? r.json() : { foods: [] }),
          apiSearchOpenFoodFacts(query),
        ])
        const serverLocal = localResult.status === 'fulfilled' ? localResult.value : []
        const usdaRes    = usdaResult.status  === 'fulfilled' ? usdaResult.value  : { foods: [] }
        const offProducts = offResult.status  === 'fulfilled' ? offResult.value   : []

        const localIds = new Set(localFoods.map(f => f.id))
        const mergedLocal = [
          ...localMatches,
          ...serverLocal.filter(f => !localIds.has(f.id) && !localMatches.some(m => m.id === f.id)).slice(0, 3),
        ]

        const usdaItems: USDAFoodItem[] = (usdaRes.foods ?? []).slice(0, 8)
        const localNames = new Set(mergedLocal.map(f => f.name.toLowerCase()))
        const filteredUSDA = usdaItems.filter(i => !localNames.has(i.description.toLowerCase()))

        // Deduplicate OFF against local + USDA by name
        const takenNames = new Set([
          ...localNames,
          ...filteredUSDA.map(i => i.description.toLowerCase()),
        ])
        const filteredOFF = offProducts
          .filter(p => p.product_name && !takenNames.has(p.product_name.toLowerCase()))
          .slice(0, 4)

        const groups: SuggestionGroup[] = []
        if (mergedLocal.length > 0) {
          groups.push({ label: 'In your library', items: mergedLocal.map(f => ({ kind: 'local' as const, food: f })) })
        }
        if (filteredUSDA.length > 0) {
          groups.push({ label: 'From USDA', items: filteredUSDA.map(i => ({ kind: 'usda' as const, item: i })) })
        }
        if (filteredOFF.length > 0) {
          groups.push({ label: 'Open Food Facts', items: filteredOFF.map(p => ({ kind: 'off' as const, product: p })) })
        }
        setSuggestions(groups)
        
      } catch {
        // Keep showing local results on error
      }
    }, 400)
    
  }

  async function handleSelect(e: AutoCompleteSelectEvent) {
    const item = e.value as SuggestionItem
    if (item.kind === 'local') {
      setInputValue(item.food.name)
      onChange(item.food)
      return
    }

    setImporting(true)
    try {
      let foodData: Omit<Food, 'id'>
      if (item.kind === 'usda') {
        foodData = mapUSDAFoodToFood(item.item)
      } else {
        foodData = mapOFFProductToFood(item.product)
      }
      const created = await apiCreateFood(foodData)
      setInputValue(created.name)
      onChange(created)
    } catch {
      // Import failed — no-op, user can try again
    } finally {
      setImporting(false)
    }
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    acRef.current?.search(e, inputValue)
  }

  const itemTemplate = (item: SuggestionItem) => (
    <div className="food-search-item">
      <span className="food-search-item-name">{itemName(item)}</span>
      <span className="food-search-item-meta">{itemMacros(item)}</span>
    </div>
  )

  const groupTemplate = (group: SuggestionGroup) => (
    <div className="food-search-group-label">{group.label}</div>
  )

  function handleOnChange(e: AutoCompleteChangeEvent<SuggestionItem>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = e.value as any
    if (typeof val === 'string') {
      setInputValue(val)
      if (!val.trim()) setSuggestions([])
    }
  }

  return (
    <div className={`food-search${importing ? ' food-search--importing' : ''}`}>
      <AutoComplete
        ref={acRef}
        value={inputValue}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        suggestions={suggestions as any[]}
        completeMethod={handleComplete}
        onSelect={handleSelect}
        onFocus={handleFocus}
        onChange={handleOnChange}
        field="name"
        optionGroupLabel="label"
        optionGroupChildren="items"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        optionGroupTemplate={groupTemplate as any}
        itemTemplate={itemTemplate}
        placeholder={importing ? 'Importing…' : placeholder}
        disabled={importing}
        delay={0}
        inputClassName="text-input"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pt={{ input: { 'aria-label': inputAriaLabel } as any }}
      />
    </div>
  )
}
