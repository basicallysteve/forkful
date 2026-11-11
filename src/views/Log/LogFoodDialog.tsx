'use client'

import { useEffect, useRef, useState } from 'react'
import { DataView } from 'primereact/dataview'
import { InputText } from 'primereact/inputtext'
import { InputNumber } from 'primereact/inputnumber'
import type { InputNumberValueChangeEvent } from 'primereact/inputnumber'
import { Dropdown } from 'primereact/dropdown'
import Modal from '@/components/Modal/Modal'
import { apiFetchFoods } from '@/lib/api/foods'
import { apiCreateFoodLogEntry } from '@/lib/api/foodLog'
import { getUnitLabel, allowedUnitsForFood } from '@/utils/unitConversion'
import type { Food } from '@/types/Food'
import type { FoodLogEntry } from '@/types/FoodLogEntry'

interface LogFoodDialogProps {
  visible: boolean
  // The meal section this log was launched from (Breakfast/Lunch/Dinner). A display label only for
  // now — see the meal-slot TODO in Index.tsx; nothing is persisted against it yet.
  meal: string
  logDate: string
  // Foods already cached in the shared store, used for instant local results before the server search
  // resolves. The dialog never eagerly fetches the whole catalog.
  seedFoods: Food[]
  onHide: () => void
  onLogged: (entry: FoodLogEntry) => void
}

const MAX_RESULTS = 50

export default function LogFoodDialog({ visible, meal, logDate, seedFoods, onHide, onLogged }: LogFoodDialogProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Food[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedFood, setSelectedFood] = useState<Food | null>(null)
  const [amount, setAmount] = useState<number>(1)
  const [unit, setUnit] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestQueryRef = useRef<string>('')

  // Reset to the search step each time the dialog (re)opens.
  useEffect(() => {
    if (!visible) return
    setQuery('')
    setResults(seedFoods.slice(0, MAX_RESULTS))
    setSelectedFood(null)
    setAmount(1)
    setUnit('')
    setError(null)
  }, [visible, seedFoods])

  // Debounced fuzzy search against the foods catalog; empty query falls back to the seeded store foods.
  useEffect(() => {
    const q = query.trim()
    latestQueryRef.current = q
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!q) {
      setResults(seedFoods.slice(0, MAX_RESULTS))
      setSearching(false)
      return
    }

    // Instant local filter for snappiness, then replace with ranked server results.
    const lq = q.toLowerCase()
    setResults(seedFoods.filter((f) => f.name.toLowerCase().includes(lq)).slice(0, MAX_RESULTS))
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const found = await apiFetchFoods({ search: q })
        if (latestQueryRef.current !== q) return
        setResults(found.slice(0, MAX_RESULTS))
      } catch {
        // Keep the local results on failure.
      } finally {
        if (latestQueryRef.current === q) setSearching(false)
      }
    }, 300)
  }, [query, seedFoods])

  const unitOptions = selectedFood
    ? allowedUnitsForFood(selectedFood).map((u) => ({ label: getUnitLabel(u), value: u }))
    : []

  function pickFood(food: Food) {
    setSelectedFood(food)
    setUnit(allowedUnitsForFood(food)[0])
    setAmount(1)
    setError(null)
  }

  async function confirmLog() {
    if (!selectedFood || !unit || !amount || amount <= 0) {
      setError('Enter an amount and unit.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const entry = await apiCreateFoodLogEntry({ foodId: selectedFood.id, amount, unit, logDate })
      onLogged(entry)
      onHide()
    } catch {
      setError('Could not log that. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const foodItem = (food: Food) => (
    <button type="button" className="log-food-item" onClick={() => pickFood(food)}>
      <span className="log-food-item-name">{food.name}</span>
      <span className="log-food-item-macros">
        {food.calories} cal · P {food.protein}g · C {food.carbs}g · F {food.fat}g
      </span>
    </button>
  )

  return (
    <Modal
      visible={visible}
      onHide={onHide}
      header={`Log to ${meal}`}
      style={{ width: '560px', maxWidth: '95vw' }}
      className="log-food-dialog"
    >
      {!selectedFood ? (
        <div className="log-food-picker">
          <InputText
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search foods…"
            autoFocus
            className="text-input log-food-search"
            aria-label="Search foods"
          />
          <DataView
            value={results}
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
            itemTemplate={foodItem as any}
            layout="list"
            emptyMessage={searching ? 'Searching…' : 'No foods found. Try another search.'}
            paginator={results.length > 10}
            rows={10}
          />
        </div>
      ) : (
        <div className="log-food-confirm">
          <button type="button" className="log-food-back" onClick={() => setSelectedFood(null)}>
            ← Back to search
          </button>
          <p className="log-food-selected">{selectedFood.name}</p>
          <div className="log-food-fields">
            <label className="log-field">
              <span>Amount</span>
              <InputNumber
                value={amount}
                onValueChange={(e: InputNumberValueChangeEvent) => setAmount(e.value ?? 0)}
                min={0}
                minFractionDigits={0}
                maxFractionDigits={2}
                inputClassName="text-input"
              />
            </label>
            <label className="log-field">
              <span>Unit</span>
              <Dropdown
                value={unit}
                options={unitOptions}
                onChange={(e) => setUnit(e.value)}
                placeholder="Unit"
              />
            </label>
          </div>
          {error && <p className="daily-log-error" role="alert">{error}</p>}
          <div className="log-food-actions">
            <button type="button" className="log-food-cancel" onClick={onHide} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="log-food-submit" onClick={confirmLog} disabled={saving}>
              {saving ? 'Logging…' : `Log to ${meal}`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
