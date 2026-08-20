'use client'

import { useEffect, useMemo, useState } from 'react'
import { InputNumber } from 'primereact/inputnumber'
import type { InputNumberValueChangeEvent } from 'primereact/inputnumber'
import { Dropdown } from 'primereact/dropdown'
import FoodSearch from '@/components/FoodSearch/FoodSearch'
import { useFoodStore } from '@/stores/food'
import { useFoodLogStore, sumMacros } from '@/stores/foodLog'
import { apiFetchDailyLog, apiCreateFoodLogEntry } from '@/lib/api/foodLog'
import { getTodayDateString, formatDisplayDate } from '@/utils/dateHelpers'
import { getUnitLabel, allowedUnitsForFood } from '@/utils/unitConversion'
import type { Food } from '@/types/Food'

const MACRO_FIELDS = [
  { key: 'calories', label: 'Calories', unit: '' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
] as const

export default function Log() {
  // Seeds FoodSearch's instant local ranking from whatever the shared food store already holds; this
  // view no longer eagerly fetches the full catalog (FoodSearch queries the server per keystroke).
  const foods = useFoodStore((state) => state.foods)
  const entries = useFoodLogStore((state) => state.entries)
  const setDailyLog = useFoodLogStore((state) => state.setDailyLog)
  const addEntry = useFoodLogStore((state) => state.addEntry)

  const [today] = useState<string>(() => getTodayDateString())
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  const [selectedFood, setSelectedFood] = useState<Food | null>(null)
  const [foodName, setFoodName] = useState('')
  const [amount, setAmount] = useState<number>(1)
  const [unit, setUnit] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    apiFetchDailyLog(today)
      .then(setDailyLog)
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false))
  }, [today, setDailyLog])

  const total = useMemo(() => sumMacros(entries), [entries])
  const unitOptions = useMemo(
    () => (selectedFood ? allowedUnitsForFood(selectedFood).map((u) => ({ label: getUnitLabel(u), value: u })) : []),
    [selectedFood]
  )

  function handleSelectFood(food: Food) {
    setSelectedFood(food)
    setFoodName(food.name)
    const units = allowedUnitsForFood(food)
    setUnit(units[0])
    setSaveError(null)
  }

  function handleFoodInputChange(value: string) {
    setFoodName(value)
    // Editing the text invalidates a previously chosen food, so a stale selection can't be logged.
    if (selectedFood) setSelectedFood(null)
  }

  async function handleLog() {
    if (!selectedFood || !unit || !amount || amount <= 0) {
      setSaveError('Pick a food, amount, and unit first.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const entry = await apiCreateFoodLogEntry({
        foodId: selectedFood.id,
        amount,
        unit,
        logDate: today,
      })
      addEntry(entry)
      // Reset the form for the next entry.
      setSelectedFood(null)
      setFoodName('')
      setAmount(1)
      setUnit('')
    } catch {
      setSaveError('Could not log that. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="daily-log">
      <div className="daily-log-content">
        <div className="daily-log-header">
          <p className="daily-log-label">Food Logging</p>
          <h1 className="daily-log-title">Today&apos;s Log</h1>
          <p className="daily-log-date">{formatDisplayDate(new Date(`${today}T00:00:00`))}</p>
        </div>

        {/* Gated on a resolved fetch (like the entries table below) so the singleton store can't flash
            a previous day's or previous user's totals before today's Daily Log loads. */}
        {!loading && !fetchError && (
          <div className="daily-log-total" aria-label="Today's total">
            {MACRO_FIELDS.map((m) => (
              <div key={m.key} className="macro-stat">
                <span className="macro-stat-value">{total[m.key]}{m.unit}</span>
                <span className="macro-stat-label">{m.label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="daily-log-form">
          <div className="log-field log-field--food">
            <label>Food</label>
            <FoodSearch
              value={foodName}
              localFoods={foods}
              onChange={handleSelectFood}
              onInputChange={handleFoodInputChange}
              placeholder="Search a food to log…"
              inputAriaLabel="Search a food to log"
            />
          </div>
          <div className="log-field log-field--amount">
            <label htmlFor="log-amount">Amount</label>
            <InputNumber
              inputId="log-amount"
              value={amount}
              onValueChange={(e: InputNumberValueChangeEvent) => setAmount(e.value ?? 0)}
              min={0}
              minFractionDigits={0}
              maxFractionDigits={2}
              inputClassName="text-input"
            />
          </div>
          <div className="log-field log-field--unit">
            <label htmlFor="log-unit">Unit</label>
            <Dropdown
              inputId="log-unit"
              value={unit}
              options={unitOptions}
              onChange={(e) => setUnit(e.value)}
              placeholder="Unit"
              disabled={!selectedFood}
            />
          </div>
          <button
            type="button"
            className="primary-button log-submit"
            onClick={handleLog}
            disabled={saving || !selectedFood}
          >
            {saving ? 'Logging…' : 'Log food'}
          </button>
        </div>
        {saveError && <p className="daily-log-error" role="alert">{saveError}</p>}

        <div className="daily-log-entries">
          {loading ? (
            <p className="daily-log-empty">Loading today&apos;s log…</p>
          ) : fetchError ? (
            <p className="daily-log-empty">Could not load today&apos;s log.</p>
          ) : entries.length === 0 ? (
            <p className="daily-log-empty">Nothing logged yet today. Search a food above to start.</p>
          ) : (
            <table className="daily-log-table">
              <thead>
                <tr>
                  <th>Food</th>
                  <th>Amount</th>
                  <th>Calories</th>
                  <th>Protein</th>
                  <th>Carbs</th>
                  <th>Fat</th>
                  <th>Fiber</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td>{e.food?.name ?? 'Deleted food'}</td>
                    <td>{e.amount} {e.unit ? getUnitLabel(e.unit) : ''}</td>
                    <td>{e.calories}</td>
                    <td>{e.protein}g</td>
                    <td>{e.carbs}g</td>
                    <td>{e.fat}g</td>
                    <td>{e.fiber}g</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
