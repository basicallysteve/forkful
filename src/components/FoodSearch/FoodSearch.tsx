'use client'

import { useRef, useState, useEffect } from 'react'
import { AutoComplete } from 'primereact/autocomplete'
import type { AutoCompleteCompleteEvent, AutoCompleteSelectEvent, AutoCompleteChangeEvent } from 'primereact/autocomplete'
import { useSession } from 'next-auth/react'
import SignInRequiredMessage from '@/components/SignInRequiredMessage/SignInRequiredMessage'
import QuickAddFoodModal from '@/components/QuickAddFoodModal/QuickAddFoodModal'
import { apiFetchFoods, apiCreateFood } from '@/lib/api/foods'
import { isUnauthorizedError, SIGN_IN_REQUIRED_MESSAGE } from '@/lib/api/errors'
import { apiSearchOpenFoodFacts, mapOFFProductToFood } from '@/lib/api/openFoodFacts'
import type { Food } from '@/types/Food'
import type { OFFProduct } from '@/types/OpenFoodFacts'
import './food-search.scss'

type SuggestionGroup = {
  label: string
  /** Item-less group shown while the online search runs */
  searching?: boolean
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

function addGroup(query: string): SuggestionGroup {
  return { label: 'Not found?', items: [{ kind: 'add', name: query }] }
}

type AddFoodRequest = { name: string }

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
  const [addDialog, setAddDialog] = useState<AddFoodRequest | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestQueryRef = useRef<string>('')
  const acRef = useRef<AutoComplete>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { status } = useSession()
  // Read through a ref so the debounced callback sees the current auth state
  // Only hide once we know the user is signed out; while the session is still loading the
  // add row shows, so it isn't missing on a fast first keystroke.
  const canAddRef = useRef(true)
  canAddRef.current = status !== 'unauthenticated'

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
    // Show the panel immediately: local matches, a "Searching…" row while the
    // online search runs, and the add row (always last, so it stays put).
    const immediate: SuggestionGroup[] = []
    if (localMatches.length > 0) {
      immediate.push({ label: 'In your library', items: localMatches.map(f => ({ kind: 'local' as const, food: f })) })
    }
    // An item-less group renders as a non-focusable status line, not an option
    immediate.push({ label: 'Searching…', items: [], searching: true })
    if (canAddRef.current) immediate.push(addGroup(query))
    setSuggestions(immediate)

    latestQueryRef.current = query
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (latestQueryRef.current !== query) return

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

      // Offer manual add as a last resort (signed-in users only)
      if (canAddRef.current) groups.push(addGroup(query))

      setSuggestions(groups)
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
      setAddDialog({ name: item.name })
      return
    }

    setImporting(true)
    try {
      const created = await apiCreateFood(mapOFFProductToFood(item.product))
      setInputValue(created.name)
      onChange(created)
    } catch (err) {
      // Import failed — user can try again
      if (isUnauthorizedError(err)) setAddError(SIGN_IN_REQUIRED_MESSAGE)
    } finally {
      setImporting(false)
    }
  }

  function closeAddDialog() {
    setAddDialog(null)
    setAddError(null)
    // The modal steals focus; hand it back to the search input.
    containerRef.current?.querySelector<HTMLInputElement>('input')?.focus()
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
    <div
      className={`food-search-group-label${group.searching ? ' food-search-group-label--searching' : ''}`}
      {...(group.searching ? { role: 'status' } : {})}
    >
      {group.label}
    </div>
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
      <div ref={containerRef} className={`food-search${importing ? ' food-search--importing' : ''}`}>
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
          scrollHeight="260px"
          inputClassName="text-input"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pt={{ input: { 'aria-label': inputAriaLabel } as any }}
        />
        {addError && !addDialog && <p className="add-food-error" role="alert"><SignInRequiredMessage /></p>}
      </div>

      {addDialog && (
        <QuickAddFoodModal
          initialName={addDialog.name}
          onHide={closeAddDialog}
          onCreated={created => {
            setInputValue(created.name)
            onChange(created)
            closeAddDialog()
          }}
        />
      )}
    </>
  )
}
