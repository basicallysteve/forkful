'use client'

import { useRef, useState, useEffect } from 'react'
import { AutoComplete } from 'primereact/autocomplete'
import type { AutoCompleteCompleteEvent, AutoCompleteSelectEvent, AutoCompleteChangeEvent } from 'primereact/autocomplete'
import { InputText } from 'primereact/inputtext'
import Modal from '@/components/Modal/Modal'
import { apiFetchFoods, apiCreateFood } from '@/lib/api/foods'
import { apiSearchOpenFoodFacts, mapOFFProductToFood } from '@/lib/api/openFoodFacts'
import type { Food } from '@/types/Food'
import type { OFFProduct } from '@/types/OpenFoodFacts'
import './food-search.scss'

type SuggestionGroup = {
  label: string
  items: SuggestionItem[]
}

type SuggestionItem =
  | { kind: 'local'; food: Food }
  | { kind: 'off'; product: OFFProduct }
  | { kind: 'add'; name: string }

function itemName(s: SuggestionItem): string {
  if (s.kind === 'local') return s.food.name
  if (s.kind === 'off') return s.product.product_name
  return `Add "${s.name}" as a new food`
}

function itemMacros(s: SuggestionItem): string {
  if (s.kind === 'local') {
    return `${s.food.calories} cal · P ${s.food.protein}g · C ${s.food.carbs}g · F ${s.food.fat}g`
  }
  if (s.kind === 'off') {
    const f = mapOFFProductToFood(s.product)
    return `${f.calories} cal · P ${f.protein}g · C ${f.carbs}g · F ${f.fat}g`
  }
  return 'Fill in macros manually'
}

type AddFoodForm = {
  name: string
  calories: string
  protein: string
  carbs: string
  fat: string
}

interface FoodSearchProps {
  value: string
  localFoods: Food[]
  onChange: (food: Food) => void
  /** Fired when the user edits the search text directly (not via selecting a suggestion). Lets a parent invalidate a previously selected food. */
  onInputChange?: (value: string) => void
  placeholder?: string
  inputAriaLabel?: string
}

export default function FoodSearch({ value, localFoods, onChange, onInputChange, placeholder, inputAriaLabel }: FoodSearchProps) {
  const [inputValue, setInputValue] = useState(value)
  const [suggestions, setSuggestions] = useState<SuggestionGroup[]>([])
  const [importing, setImporting] = useState(false)
  const [addDialog, setAddDialog] = useState<AddFoodForm | null>(null)
  const [addSaving, setAddSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestQueryRef = useRef<string>('')
  const acRef = useRef<AutoComplete>(null)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  async function handleComplete(e: AutoCompleteCompleteEvent) {
    const query = e.query.trim()
    if (!query) {
      setSuggestions([])
      return
    }

    // Immediate: local food list, ranked by relevance (exact → starts-with → contains)
    const lq = query.toLowerCase()
    const localMatches = localFoods
      .filter(f => f.name.toLowerCase().includes(lq))
      .sort((a, b) => {
        const an = a.name.toLowerCase()
        const bn = b.name.toLowerCase()
        const primaryA = an.split(',')[0]
        const primaryB = bn.split(',')[0]
        const rankA = an === lq ? 0 : primaryA.startsWith(lq) ? 1 : an.startsWith(lq) ? 2 : 3
        const rankB = bn === lq ? 0 : primaryB.startsWith(lq) ? 1 : bn.startsWith(lq) ? 2 : 3
        if (rankA !== rankB) return rankA - rankB
        return an.localeCompare(bn)
      })
      .slice(0, 6)
    setSuggestions(localMatches.length > 0
      ? [{ label: 'In your library', items: localMatches.map(f => ({ kind: 'local' as const, food: f })) }]
      : []
    )

    latestQueryRef.current = query
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (latestQueryRef.current !== query) return

      try {
        const [localResult, offResult] = await Promise.allSettled([
          apiFetchFoods({ search: query }),
          apiSearchOpenFoodFacts(query),
        ])

        if (latestQueryRef.current !== query) return

        const serverLocal = localResult.status === 'fulfilled' ? localResult.value : []
        const offProducts = offResult.status  === 'fulfilled' ? offResult.value   : []

        const localIds = new Set(localFoods.map(f => f.id))
        const mergedLocal = [
          ...localMatches,
          ...serverLocal.filter(f => !localIds.has(f.id) && !localMatches.some(m => m.id === f.id)).slice(0, 3),
        ]

        const localNames = new Set(mergedLocal.map(f => f.name.toLowerCase()))
        const filteredOFF = offProducts
          .filter((p: OFFProduct) => p.product_name && !localNames.has(p.product_name.toLowerCase()))
          .slice(0, 4)

        const onlineItems: SuggestionItem[] = filteredOFF.map((p: OFFProduct) => ({ kind: 'off' as const, product: p }))

        const groups: SuggestionGroup[] = []
        if (mergedLocal.length > 0) {
          groups.push({ label: 'In your library', items: mergedLocal.map(f => ({ kind: 'local' as const, food: f })) })
        }
        if (onlineItems.length > 0) {
          groups.push({ label: 'Online results', items: onlineItems })
        }

        // Always offer manual add as a last resort
        groups.push({ label: 'Not found?', items: [{ kind: 'add' as const, name: query }] })

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

    if (item.kind === 'add') {
      setAddDialog({ name: item.name, calories: '', protein: '0', carbs: '0', fat: '0' })
      return
    }

    setImporting(true)
    try {
      const created = await apiCreateFood(mapOFFProductToFood(item.product))
      setInputValue(created.name)
      onChange(created)
    } catch {
      // Import failed — no-op, user can try again
    } finally {
      setImporting(false)
    }
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!addDialog) return
    setAddSaving(true)
    try {
      const created = await apiCreateFood({
        name: addDialog.name,
        calories: Number(addDialog.calories) || 0,
        protein: Number(addDialog.protein) || 0,
        carbs: Number(addDialog.carbs) || 0,
        fat: Number(addDialog.fat) || 0,
        fiber: 0,
        servingSize: 100,
        servingUnit: 'g',
        measurements: [{ unit: 'g' }],
      })
      setInputValue(created.name)
      onChange(created)
      setAddDialog(null)
    } catch {
      // Silently fail — user can retry
    } finally {
      setAddSaving(false)
    }
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    acRef.current?.search(e, inputValue)
  }

  const itemTemplate = (item: SuggestionItem) => (
    <div className={`food-search-item${item.kind === 'add' ? ' food-search-item--add' : ''}`}>
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
      onInputChange?.(val)
    }
  }

  return (
    <>
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

      {addDialog && (
        <Modal
          visible
          onHide={() => setAddDialog(null)}
          header="Add a new food"
          style={{ width: '420px', maxWidth: '95vw' }}
        >
          <form onSubmit={handleAddSubmit} className="add-food-form">
            <label className="form-field">
              <span>Name</span>
              <InputText
                value={addDialog.name}
                onChange={e => setAddDialog(d => d ? { ...d, name: e.target.value } : d)}
                required
                autoFocus
              />
            </label>
            <label className="form-field">
              <span>Calories</span>
              <input
                type="number"
                min="0"
                className="text-input"
                value={addDialog.calories}
                onChange={e => setAddDialog(d => d ? { ...d, calories: e.target.value } : d)}
                required
              />
            </label>
            <div className="form-row">
              <label className="form-field">
                <span>Protein (g)</span>
                <input type="number" min="0" step="0.1" className="text-input" value={addDialog.protein}
                  onChange={e => setAddDialog(d => d ? { ...d, protein: e.target.value } : d)} />
              </label>
              <label className="form-field">
                <span>Carbs (g)</span>
                <input type="number" min="0" step="0.1" className="text-input" value={addDialog.carbs}
                  onChange={e => setAddDialog(d => d ? { ...d, carbs: e.target.value } : d)} />
              </label>
              <label className="form-field">
                <span>Fat (g)</span>
                <input type="number" min="0" step="0.1" className="text-input" value={addDialog.fat}
                  onChange={e => setAddDialog(d => d ? { ...d, fat: e.target.value } : d)} />
              </label>
            </div>
            <p className="add-food-note">Nutrition is per 100 g serving. You can edit more details later.</p>
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={() => setAddDialog(null)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={addSaving}>
                {addSaving ? 'Saving…' : 'Add food'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
