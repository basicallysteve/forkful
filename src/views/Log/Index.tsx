'use client'

import { useEffect, useMemo, useState } from 'react'
import { Carousel } from 'primereact/carousel'
import { useFoodStore } from '@/stores/food'
import { useFoodLogStore, sumMacros } from '@/stores/foodLog'
import { apiFetchDailyLog } from '@/lib/api/foodLog'
import { getTodayDateString, formatDisplayDate } from '@/utils/dateHelpers'
import { getUnitLabel } from '@/utils/unitConversion'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { FoodLogEntry, Macros } from '@/types/FoodLogEntry'
import LogFoodDialog from './LogFoodDialog'

type MacroField = { key: keyof Macros; label: string; unit: string }

const MACRO_FIELDS: readonly MacroField[] = [
  { key: 'calories', label: 'Calories', unit: '' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
]

// TODO(meal-slots): "Breakfast/Lunch/Dinner" are hard-coded stubs. A Meal Slot (see CONTEXT.md) is a
// per-User, editable, ordered set snapshotted onto each Food Log Entry — deferred to a later slice.
// When that lands: drive these sections from the user's configured slots, tag each created entry with
// the section it was logged from, and render the day's entries grouped under their slot instead of the
// single flat "Logged today" list below.
const MEAL_SECTIONS = ['Breakfast', 'Lunch', 'Dinner'] as const

export default function Log() {
  // Seeds the log dialog's instant local results from whatever the shared food store already holds;
  // this view never eagerly fetches the full catalog (the dialog searches the server per keystroke).
  const foods = useFoodStore((state) => state.foods)
  const entries = useFoodLogStore((state) => state.entries)
  const setDailyLog = useFoodLogStore((state) => state.setDailyLog)
  const addEntry = useFoodLogStore((state) => state.addEntry)
  const isMobile = useIsMobile()

  const [today] = useState<string>(() => getTodayDateString())
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  // The meal section whose log dialog is open, or null when closed.
  const [dialogMeal, setDialogMeal] = useState<string | null>(null)
  // Meal sections are collapsible so the mobile stack stays scannable; all start expanded.
  const [collapsedMeals, setCollapsedMeals] = useState<Record<string, boolean>>({})

  function toggleMeal(meal: string) {
    setCollapsedMeals((prev) => ({ ...prev, [meal]: !prev[meal] }))
  }

  useEffect(() => {
    apiFetchDailyLog(today)
      .then(setDailyLog)
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false))
  }, [today, setDailyLog])

  const total = useMemo(() => sumMacros(entries), [entries])

  function handleLogged(entry: FoodLogEntry) {
    addEntry(entry)
  }

  const macroCard = (m: MacroField) => (
    <div className="macro-stat">
      <span className="macro-stat-value">{total[m.key]}{m.unit}</span>
      <span className="macro-stat-label">{m.label}</span>
    </div>
  )

  return (
    <div className="daily-log">
      <div className="daily-log-content">
        <div className="daily-log-header">
          <p className="daily-log-label">Food Logging</p>
          <h1 className="daily-log-title">Today&apos;s Log</h1>
          <p className="daily-log-date">{formatDisplayDate(new Date(`${today}T00:00:00`))}</p>
        </div>

        {/* Gated on a resolved fetch (like the entries table below) so the singleton store can't flash
            a previous day's or previous user's totals before today's Daily Log loads. On mobile the
            five stat cards become a swipeable carousel instead of a tall stack. */}
        {!loading && !fetchError && (
          isMobile ? (
            <Carousel
              value={MACRO_FIELDS as MacroField[]}
              itemTemplate={macroCard}
              numVisible={1}
              numScroll={1}
              showNavigators={false}
              showIndicators
              circular
              className="daily-log-total-carousel"
            />
          ) : (
            <div className="daily-log-total" aria-label="Today's total">
              {MACRO_FIELDS.map((m) => (
                <div key={m.key} className="macro-stat">
                  <span className="macro-stat-value">{total[m.key]}{m.unit}</span>
                  <span className="macro-stat-label">{m.label}</span>
                </div>
              ))}
            </div>
          )
        )}

        <div className="daily-log-meals">
          {MEAL_SECTIONS.map((meal) => {
            const collapsed = !!collapsedMeals[meal]
            return (
              <section key={meal} className={`daily-log-meal${collapsed ? ' daily-log-meal--collapsed' : ''}`}>
                <button
                  type="button"
                  className="daily-log-meal-toggle"
                  aria-expanded={!collapsed}
                  onClick={() => toggleMeal(meal)}
                >
                  <span className="daily-log-meal-title">{meal}</span>
                  <span className="daily-log-meal-chevron" aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
                </button>
                {!collapsed && (
                  <div className="daily-log-meal-body">
                    <button
                      type="button"
                      className="daily-log-meal-add"
                      onClick={() => setDialogMeal(meal)}
                    >
                      + Log food
                    </button>
                  </div>
                )}
              </section>
            )
          })}
        </div>

        <div className="daily-log-entries">
          <h2 className="daily-log-entries-title">Logged today</h2>
          {loading ? (
            <p className="daily-log-empty">Loading today&apos;s log…</p>
          ) : fetchError ? (
            <p className="daily-log-empty">Could not load today&apos;s log.</p>
          ) : entries.length === 0 ? (
            <p className="daily-log-empty">Nothing logged yet today. Use “+ Log food” above to start.</p>
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

      <LogFoodDialog
        visible={dialogMeal !== null}
        meal={dialogMeal ?? ''}
        logDate={today}
        seedFoods={foods}
        onHide={() => setDialogMeal(null)}
        onLogged={handleLogged}
      />
    </div>
  )
}
