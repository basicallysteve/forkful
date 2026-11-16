'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Carousel } from 'primereact/carousel'
import { useFoodStore } from '@/stores/food'
import { useFoodLogStore, sumMacros } from '@/stores/foodLog'
import { isUnauthorizedError } from '@/lib/api/errors'
import { apiFetchDailyLog } from '@/lib/api/foodLog'
import { getTodayDateString, formatDisplayDate } from '@/utils/dateHelpers'
import { getUnitLabel } from '@/utils/unitConversion'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { FoodLogEntry, Macros } from '@/types/FoodLogEntry'
import { groupEntriesBySlot } from '@/utils/mealSlots'
import LogFoodDialog from './LogFoodDialog'

type MacroField = { key: keyof Macros; label: string; unit: string }

const MACRO_FIELDS: readonly MacroField[] = [
  { key: 'calories', label: 'Calories', unit: '' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
]

const macroLine = (e: FoodLogEntry) =>
  `Protein ${e.protein}g · Carbs ${e.carbs}g · Fat ${e.fat}g · Fiber ${e.fiber}g`

export default function Log({ mealSlots }: { mealSlots: string[] }) {
  // Seeds the log dialog's instant local results from whatever the shared food store already holds;
  // this view never eagerly fetches the full catalog (the dialog searches the server per keystroke).
  const foods = useFoodStore((state) => state.foods)
  const entries = useFoodLogStore((state) => state.entries)
  const setDailyLog = useFoodLogStore((state) => state.setDailyLog)
  const addEntry = useFoodLogStore((state) => state.addEntry)
  const isMobile = useIsMobile()

  const [today, setToday] = useState<string>(() => getTodayDateString())
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [needsSignIn, setNeedsSignIn] = useState(false)
  // Whether the log dialog is open, and the Meal Slot it was launched from (null = no slot).
  const [dialog, setDialog] = useState<{ slot: string | null } | null>(null)
  // Meal sections are collapsible so the mobile stack stays scannable; all start expanded.
  const [collapsedMeals, setCollapsedMeals] = useState<Record<string, boolean>>({})

  function toggleMeal(meal: string) {
    setCollapsedMeals((prev) => ({ ...prev, [meal]: !prev[meal] }))
  }

  useEffect(() => {
    apiFetchDailyLog(today)
      .then(setDailyLog)
      .catch((err) => (isUnauthorizedError(err) ? setNeedsSignIn(true) : setFetchError(true)))
      .finally(() => setLoading(false))
  }, [today, setDailyLog])

  const total = useMemo(() => sumMacros(entries), [entries])
  const groups = useMemo(() => groupEntriesBySlot(entries, mealSlots), [entries, mealSlots])
  const showEntries = !loading && !needsSignIn && !fetchError

  function handleLogged(entry: FoodLogEntry) {
    // The dialog works out the day at each write, so a log submitted after midnight lands on the new
    // day: follow it (the effect above reloads that day's log) instead of mixing days in the list.
    if (entry.logDate && entry.logDate !== today) {
      setLoading(true)
      setToday(entry.logDate)
      return
    }
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
        {!loading && !fetchError && !needsSignIn && (
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

        {!showEntries ? (
          <p className="daily-log-empty">
            {loading ? (
              'Loading today’s log…'
            ) : needsSignIn ? (
              <><Link href="/login">Sign in</Link> to see and log your food.</>
            ) : (
              'Could not load today’s log.'
            )}
          </p>
        ) : entries.length === 0 ? (
          <p className="daily-log-empty">Nothing logged yet today. Use “+ Log food” below to start.</p>
        ) : null}

        {mealSlots.length === 0 && (
          <button type="button" className="daily-log-meal-add" onClick={() => setDialog({ slot: null })}>
            + Log food
          </button>
        )}

        <div className="daily-log-meals">
          {groups.map((group) => {
            const collapsed = !!collapsedMeals[`${group.kind}:${group.label}`]
            const rows = showEntries ? group.entries : []
            return (
              <section key={`${group.kind}:${group.label}`} className={`daily-log-meal${collapsed ? ' daily-log-meal--collapsed' : ''}`}>
                <button
                  type="button"
                  className="daily-log-meal-toggle"
                  aria-expanded={!collapsed}
                  onClick={() => toggleMeal(`${group.kind}:${group.label}`)}
                >
                  <span className="daily-log-meal-title">{group.label}</span>
                  <span className="daily-log-meal-chevron" aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
                </button>
                {!collapsed && (
                  <div className="daily-log-meal-body">
                    {rows.length > 0 && (
                      <ul className="daily-log-rows">
                        {rows.map((e) => (
                          <li key={e.id} className="daily-log-row">
                            <div className="daily-log-row-main">
                              <span className="daily-log-row-name">{e.food?.name ?? 'Deleted food'}</span>
                              <span className="daily-log-row-amount">{e.amount} {e.unit ? getUnitLabel(e.unit) : ''}</span>
                              <span className="daily-log-row-cal">{e.calories} kcal</span>
                            </div>
                            <div className="daily-log-row-macros">{macroLine(e)}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                    {group.kind === 'slot' && (
                      <button
                        type="button"
                        className="daily-log-meal-add"
                        onClick={() => setDialog({ slot: group.label })}
                      >
                        + Log food
                      </button>
                    )}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      </div>

      <LogFoodDialog
        visible={dialog !== null}
        mealSlot={dialog?.slot ?? null}
        mealSlots={mealSlots}
        seedFoods={foods}
        onHide={() => setDialog(null)}
        onLogged={handleLogged}
      />
    </div>
  )
}
