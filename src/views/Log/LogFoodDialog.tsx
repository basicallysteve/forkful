'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import Modal from '@/components/Modal/Modal'
import QuantityInput from '@/components/QuantityInput/QuantityInput'
import { apiFetchFoods } from '@/lib/api/foods'
import { apiCreateFoodLogEntry } from '@/lib/api/foodLog'
import { isUnauthorizedError } from '@/lib/api/errors'
import { getTodayDateString } from '@/utils/dateHelpers'
import { getUnitLabel, allowedUnitsForFood, unitResolvesForFood } from '@/utils/unitConversion'
import type { Food } from '@/types/Food'
import type { FoodLogEntry } from '@/types/FoodLogEntry'

interface LogFoodDialogProps {
  visible: boolean
  // The Meal Slot this log was launched from (preselected in the picker), or null for none.
  mealSlot: string | null
  // The User's current Meal Slots, offered in the optional picker.
  mealSlots: string[]
  // Foods already cached in the shared store, used for instant local results before the server search
  // resolves. The dialog never eagerly fetches the whole catalog.
  seedFoods: Food[]
  onHide: () => void
  onLogged: (entry: FoodLogEntry) => void
}

// Results kept in memory, and how many of them are listed. Beyond DISPLAY_RESULTS the user refines the
// search instead of paging (a paginator wraps badly on a phone).
const MAX_RESULTS = 50
const DISPLAY_RESULTS = 20

// Touch devices open the keyboard on focus, which can push the dialog under the sticky header (#252),
// so only pointer devices get the search input focused automatically.
function canAutoFocus(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return !window.matchMedia('(pointer: coarse)').matches
}

export default function LogFoodDialog({ visible, mealSlot, mealSlots, seedFoods, onHide, onLogged }: LogFoodDialogProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Food[]>([])
  const [searching, setSearching] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)
  const [searchAttempt, setSearchAttempt] = useState(0)
  const [selectedFood, setSelectedFood] = useState<Food | null>(null)
  const [amount, setAmount] = useState<number | null>(1)
  const [unit, setUnit] = useState<string>('')
  // The chosen Meal Slot; '' means none (assigning a slot is always optional).
  const [slot, setSlot] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestQueryRef = useRef<string>('')
  const searchRef = useRef<HTMLInputElement>(null)
  const amountWrapRef = useRef<HTMLLabelElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)

  // Reset to the search step each time the dialog (re)opens.
  useEffect(() => {
    if (!visible) return
    setQuery('')
    setResults(seedFoods.slice(0, MAX_RESULTS))
    setSelectedFood(null)
    setAmount(1)
    setUnit('')
    setSlot(mealSlot ?? '')
    setError(null)
    setSearchFailed(false)
    // mealSlot is read only when the dialog opens; later prop changes must not reset a half-done log.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, seedFoods])

  // Debounced fuzzy search against the foods catalog; empty query falls back to the seeded store foods.
  useEffect(() => {
    const q = query.trim()
    latestQueryRef.current = q
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!q) {
      setResults(seedFoods.slice(0, MAX_RESULTS))
      setSearching(false)
      setSearchFailed(false)
      return
    }

    // Instant local filter for snappiness, then replace with ranked server results.
    const lq = q.toLowerCase()
    setResults(seedFoods.filter((f) => f.name.toLowerCase().includes(lq)).slice(0, MAX_RESULTS))
    setSearching(true)
    setSearchFailed(false)
    debounceRef.current = setTimeout(async () => {
      try {
        const found = await apiFetchFoods({ search: q })
        if (latestQueryRef.current !== q) return
        setResults(found.slice(0, MAX_RESULTS))
      } catch {
        // Keep the local results, but say the search failed so it isn't mistaken for "no matches".
        if (latestQueryRef.current === q) setSearchFailed(true)
      } finally {
        if (latestQueryRef.current === q) setSearching(false)
      }
    }, 300)
  }, [query, seedFoods, searchAttempt])

  const unitOptions = selectedFood
    ? allowedUnitsForFood(selectedFood).map((u) => ({ label: getUnitLabel(u), value: u }))
    : []

  // A stale label (the slot was renamed or removed) can't be re-picked, so it isn't offered.
  const slotOptions = [{ label: 'No slot', value: '' }, ...mealSlots.map((s) => ({ label: s, value: s }))]

  const unitHasWeight = !selectedFood || unitResolvesForFood(selectedFood, unit)

  function pickFood(food: Food) {
    setSelectedFood(food)
    setUnit(allowedUnitsForFood(food)[0])
    setAmount(1)
    setError(null)
  }

  // After picking a food the next thing to do is type an amount.
  useEffect(() => {
    if (selectedFood) amountWrapRef.current?.querySelector('input')?.focus()
  }, [selectedFood])

  function focusSearch() {
    if (canAutoFocus()) searchRef.current?.focus()
  }

  async function confirmLog() {
    if (!selectedFood || !unit || !amount || amount <= 0) {
      setError('Enter an amount and unit.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const entry = await apiCreateFoodLogEntry({ foodId: selectedFood.id, amount, unit, logDate: getTodayDateString(), mealSlot: slot || null })
      onLogged(entry)
      onHide()
    } catch (err) {
      setError(isUnauthorizedError(err) ? 'Please sign in to log food.' : 'Could not log that. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const shown = results.slice(0, DISPLAY_RESULTS)

  return (
    <Modal
      visible={visible}
      onHide={onHide}
      header={slot ? `Log to ${slot}` : 'Log food'}
      style={{ width: '560px', maxWidth: '100%' }}
      className="log-food-dialog"
      maskClassName="log-food-mask"
      onShow={focusSearch}
    >
      {!selectedFood ? (
        <div className="log-food-picker">
          <InputText
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search foods…"
            autoFocus={canAutoFocus()}
            className="text-input log-food-search"
            aria-label="Search foods"
          />
          {searchFailed && (
            <div className="log-food-search-error" role="alert">
              <span>Could not search foods.</span>
              <button type="button" className="log-food-retry" onClick={() => setSearchAttempt((n) => n + 1)}>
                Retry
              </button>
            </div>
          )}
          {shown.length > 0 ? (
            <div className="log-food-results">
              <ul className="log-food-list">
                {shown.map((food) => (
                  <li key={food.id}>
                    <button type="button" className="log-food-item" onClick={() => pickFood(food)}>
                      <span className="log-food-item-name">{food.name}</span>
                      <span className="log-food-item-macros">
                        {food.calories} cal · P {food.protein}g · C {food.carbs}g · F {food.fat}g
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {results.length > DISPLAY_RESULTS && (
                <p className="log-food-hint">Showing the top {DISPLAY_RESULTS}. Refine your search to narrow the list.</p>
              )}
            </div>
          ) : searching ? (
            <p className="log-food-empty">Searching…</p>
          ) : (
            !searchFailed && (
              <p className="log-food-empty">
                No foods found. Try another search, or check the <Link href="/foods">Foods page</Link>.
              </p>
            )
          )}
        </div>
      ) : (
        <div className="log-food-confirm">
          <button type="button" className="log-food-back" onClick={() => setSelectedFood(null)}>
            ← Back to search
          </button>
          <p className="log-food-selected">{selectedFood.name}</p>
          <div className="log-food-fields">
            <label className="log-field" ref={amountWrapRef}>
              <span>Amount</span>
              <QuantityInput value={amount} unit={unit} onChange={setAmount} />
            </label>
            <label className="log-field">
              <span>Unit</span>
              <Dropdown
                value={unit}
                options={unitOptions}
                onChange={(e) => setUnit(e.value)}
                placeholder="Unit"
                // Rendered inside the dialog (not <body>) so it scrolls with the confirm step, and the
                // actions are scrolled into view when it opens: on short windows the reserved panel space
                // makes the step taller than the dialog, which used to clip Log/Cancel.
                appendTo="self"
                onShow={() => actionsRef.current?.scrollIntoView({ block: 'nearest' })}
              />
            </label>
            {mealSlots.length > 0 && (
              <label className="log-field log-field--slot">
                <span>Meal slot (optional)</span>
                <Dropdown
                  value={slot}
                  options={slotOptions}
                  onChange={(e) => setSlot(e.value)}
                  appendTo="self"
                  onShow={() => actionsRef.current?.scrollIntoView({ block: 'nearest' })}
                />
              </label>
            )}
          </div>
          {!unitHasWeight && (
            <p className="log-food-warning" role="status">
              We cannot calculate calories for this unit.
            </p>
          )}
          {error && <p className="daily-log-error" role="alert">{error}</p>}
          <div className="log-food-actions" ref={actionsRef}>
            <button type="button" className="log-food-cancel" onClick={onHide} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="log-food-submit" onClick={confirmLog} disabled={saving}>
              {saving ? 'Logging…' : slot ? `Log to ${slot}` : 'Log food'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
