'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog } from 'primereact/dialog'
import './prepare-meal-dialog.scss'
import { Checkbox } from 'primereact/checkbox'
import type { Recipe } from '@/types/Recipe'
import type { IngredientMatch, PantryMatchOption } from '@/lib/pantry'
import { apiFetchIngredientPantryMatches, apiPrepareMeal } from '@/lib/api/pantry'
import type { PantryItem } from '@/types/PantryItem'

interface Props {
  recipe: Recipe
  visible: boolean
  onHide: () => void
  onCreated: (item: PantryItem) => void
}

type DeductionState = {
  [ingredientFoodId: number]: {
    selectedPantryItemId: number | null
    amount: string
    canAutoConvert: boolean
  }
}

const DEFAULT_EXPIRY_DAYS = 4

function defaultExpiryDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + DEFAULT_EXPIRY_DAYS)
  return d.toISOString().split('T')[0]
}

export default function PrepareMealDialog({ recipe, visible, onHide, onCreated }: Props) {
  const [step, setStep] = useState<'config' | 'deductions'>('config')
  const [servings, setServings] = useState<string>(String(recipe.serves ?? ''))
  const [expirationDate, setExpirationDate] = useState<string>(defaultExpiryDate())
  const [deductFromPantry, setDeductFromPantry] = useState(true)
  const [matches, setMatches] = useState<IngredientMatch[]>([])
  const [deductions, setDeductions] = useState<DeductionState>({})
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const servingsNum = parseInt(servings, 10)
  const servingsValid = !isNaN(servingsNum) && servingsNum >= 1

  useEffect(() => {
    if (visible) {
      setStep('config')
      setServings(String(recipe.serves ?? ''))
      setExpirationDate(defaultExpiryDate())
      setDeductFromPantry(true)
      setMatches([])
      setDeductions({})
      setError(null)
    }
  }, [visible, recipe.serves])

  const loadMatches = useCallback(async () => {
    setLoadingMatches(true)
    setError(null)
    try {
      const result = await apiFetchIngredientPantryMatches(recipe.shortId)
      setMatches(result)
      // Pre-select first match and pre-fill suggested amount for each ingredient
      const initial: DeductionState = {}
      for (const ing of result) {
        const first = ing.pantryMatches[0] ?? null
        initial[ing.ingredientFoodId] = {
          selectedPantryItemId: first?.pantryItemId ?? null,
          amount: first?.canAutoConvert && first.suggestedDeductAmount != null
            ? String(first.suggestedDeductAmount.toFixed(2))
            : '',
          canAutoConvert: first?.canAutoConvert ?? false,
        }
      }
      setDeductions(initial)
    } catch {
      setError('Failed to load pantry matches. You can still proceed without deduction.')
    } finally {
      setLoadingMatches(false)
    }
  }, [recipe.shortId])

  async function handleNext() {
    if (!servingsValid) return
    if (!deductFromPantry) {
      await submit([])
      return
    }
    await loadMatches()
    setStep('deductions')
  }

  function handleSelectPantryItem(ingredientFoodId: number, option: PantryMatchOption) {
    setDeductions(prev => ({
      ...prev,
      [ingredientFoodId]: {
        selectedPantryItemId: option.pantryItemId,
        amount: option.canAutoConvert && option.suggestedDeductAmount != null
          ? String(option.suggestedDeductAmount.toFixed(2))
          : '',
        canAutoConvert: option.canAutoConvert,
      },
    }))
  }

  async function submit(deductionList: { pantryItemId: number; amount: number }[]) {
    setSubmitting(true)
    setError(null)
    try {
      const item = await apiPrepareMeal({
        recipeShortId: recipe.shortId,
        servings: servingsNum,
        expirationDate: expirationDate || null,
        skipDeduction: !deductFromPantry,
        deductions: deductionList,
      })
      onCreated(item)
      onHide()
    } catch {
      setError('Failed to save prepared meal. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmDeductions() {
    const deductionList = Object.entries(deductions)
      .map(([, state]) => {
        if (!state.selectedPantryItemId) return null
        const amount = parseFloat(state.amount)
        if (isNaN(amount) || amount <= 0) return null
        return { pantryItemId: state.selectedPantryItemId, amount }
      })
      .filter((d): d is { pantryItemId: number; amount: number } => d !== null)

    await submit(deductionList)
  }

  const hasAnyMatches = matches.some(m => m.pantryMatches.length > 0)

  const footer = step === 'config' ? (
    <div className="dialog-footer">
      <button type="button" className="ghost-button" onClick={onHide}>Cancel</button>
      <button
        type="button"
        className="primary-button"
        onClick={handleNext}
        disabled={!servingsValid || submitting}
      >
        {deductFromPantry ? 'Next' : 'Save to Pantry'}
      </button>
    </div>
  ) : (
    <div className="dialog-footer">
      <button type="button" className="ghost-button" onClick={() => setStep('config')}>Back</button>
      <button
        type="button"
        className="primary-button"
        onClick={handleConfirmDeductions}
        disabled={submitting}
      >
        {submitting ? 'Saving…' : 'Save to Pantry'}
      </button>
    </div>
  )

  return (
    <Dialog
      header={`Prepare: ${recipe.name}`}
      visible={visible}
      onHide={onHide}
      footer={footer}
      className="app-modal prepare-meal-dialog"
      style={{ width: '520px' }}
    >
      {step === 'config' && (
        <div className="prepare-config">
          <div className="prepare-field">
            <label className="prepare-label" htmlFor="prepare-servings">
              Servings
              {!recipe.serves && <span className="prepare-required"> (required)</span>}
            </label>
            <input
              id="prepare-servings"
              type="number"
              className="prepare-input"
              min={1}
              value={servings}
              onChange={e => setServings(e.target.value)}
              placeholder={recipe.serves ? String(recipe.serves) : 'Enter serving count'}
            />
            {!servingsValid && servings !== '' && (
              <span className="prepare-field-error">Must be at least 1</span>
            )}
          </div>

          <div className="prepare-field">
            <label className="prepare-label" htmlFor="prepare-expiry">
              Use by date <span className="prepare-optional">(optional)</span>
            </label>
            <input
              id="prepare-expiry"
              type="date"
              className="prepare-input"
              value={expirationDate}
              onChange={e => setExpirationDate(e.target.value)}
            />
          </div>

          <div className="prepare-field prepare-field-checkbox">
            <Checkbox
              inputId="prepare-deduct"
              checked={deductFromPantry}
              onChange={e => setDeductFromPantry(!!e.checked)}
            />
            <label htmlFor="prepare-deduct" className="prepare-checkbox-label">
              Deduct ingredients from pantry
            </label>
          </div>
        </div>
      )}

      {step === 'deductions' && (
        <div className="prepare-deductions">
          {loadingMatches && <p className="prepare-loading">Checking your pantry…</p>}

          {!loadingMatches && !hasAnyMatches && (
            <div className="prepare-no-matches">
              <p>None of this recipe&apos;s ingredients were found in your pantry.</p>
              <p className="prepare-hint">The meal will still be saved — no deductions will be made.</p>
            </div>
          )}

          {!loadingMatches && matches.map(ing => (
            <div key={ing.ingredientFoodId} className="deduction-row">
              <div className="deduction-ingredient">
                <span className="deduction-food-name">{ing.ingredientFoodName}</span>
                <span className="deduction-recipe-qty">
                  Recipe needs: {ing.ingredientQuantity} {ing.ingredientUnit}
                </span>
              </div>

              {ing.pantryMatches.length === 0 ? (
                <p className="deduction-no-stock">Not in pantry — no deduction</p>
              ) : (
                <div className="deduction-options">
                  {ing.pantryMatches.map(opt => {
                    const state = deductions[ing.ingredientFoodId]
                    const isSelected = state?.selectedPantryItemId === opt.pantryItemId
                    return (
                      <label
                        key={opt.pantryItemId}
                        className={`deduction-option${isSelected ? ' is-selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name={`deduct-${ing.ingredientFoodId}`}
                          checked={isSelected}
                          onChange={() => handleSelectPantryItem(ing.ingredientFoodId, opt)}
                        />
                        <div className="deduction-option-body">
                          <span className="deduction-option-name">
                            {opt.itemName}
                            {opt.isExpiringSoon && (
                              <span className="deduction-expiry-badge">Expiring soon</span>
                            )}
                          </span>
                          <span className="deduction-option-stock">
                            {opt.currentSize.size.toFixed(2)} {opt.currentSize.unit} available
                          </span>
                        </div>
                      </label>
                    )
                  })}

                  {(() => {
                    const state = deductions[ing.ingredientFoodId]
                    if (!state?.selectedPantryItemId) return null
                    const selected = ing.pantryMatches.find(o => o.pantryItemId === state.selectedPantryItemId)
                    if (!selected) return null
                    return (
                      <div className="deduction-amount">
                        <label className="deduction-amount-label">
                          Amount to deduct ({selected.currentSize.unit})
                        </label>
                        {!state.canAutoConvert && (
                          <p className="deduction-hint">
                            Recipe needs {ing.ingredientQuantity} {ing.ingredientUnit} — enter equivalent in {selected.currentSize.unit}
                          </p>
                        )}
                        <input
                          type="number"
                          className="prepare-input"
                          min={0}
                          step="0.01"
                          value={state.amount}
                          onChange={e => setDeductions(prev => ({
                            ...prev,
                            [ing.ingredientFoodId]: { ...prev[ing.ingredientFoodId], amount: e.target.value },
                          }))}
                        />
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          ))}

          {error && <p className="prepare-error">{error}</p>}
        </div>
      )}
    </Dialog>
  )
}
