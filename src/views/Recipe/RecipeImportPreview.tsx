'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Dropdown } from 'primereact/dropdown'
import { InputNumber } from 'primereact/inputnumber'
import { InputText } from 'primereact/inputtext'
import { useRecipeStore } from '@/stores/recipes'
import { useFoodStore } from '@/stores/food'
import { apiCreateRecipe, apiCreateRecipeStep } from '@/lib/api/recipes'
import { apiFetchFoods } from '@/lib/api/foods'
import { toRecipeUrl } from '@/utils/slug'
import { calculateCalories, getAllowedUnits } from '@/utils/unitConversion'
import FoodSearch from '@/components/FoodSearch/FoodSearch'
import type { Food } from '@/types/Food'
import type { Recipe } from '@/types/Recipe'
import type { ResolvedIngredient } from '@/types/RecipeImport'
import type { ParsedRecipe } from '@/utils/recipeMarkdownParser'

const MEAL_OPTIONS: Recipe['meal'][] = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert']

type IngredientOverride = {
  skipped: boolean
  selectedFood: Food | null
  searchText: string
  // Editable quantity/unit, seeded from the parse. `unit: null` means "fall back to the
  // resolved Food's serving unit" — parser guesses are defaults, not commitments (ADR-0024).
  quantity: number | null
  unit: string | null
}

/**
 * Shared Recipe Import Preview. Takes a canonical ParsedRecipe (from either the Markdown
 * or URL import source) and owns everything from Ingredient Resolution through draft
 * creation: resolve fetch, editable metadata, ingredient rows, "Create Recipe", step
 * creation, store update, and navigation. `onBack` returns to the caller's source stage.
 */
export default function RecipeImportPreview({
  parsed,
  onBack,
  backLabel = '← Back',
}: {
  parsed: ParsedRecipe
  onBack: () => void
  backLabel?: string
}) {
  const router = useRouter()
  const addRecipeToStore = useRecipeStore((state) => state.addRecipe)
  const setFoods = useFoodStore((state) => state.setFoods)

  useEffect(() => {
    apiFetchFoods().then(setFoods).catch(() => {})
  }, [setFoods])

  const [resolving, setResolving] = useState(true)
  const [resolved, setResolved] = useState<ResolvedIngredient[]>([])
  const [overrides, setOverrides] = useState<IngredientOverride[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Editable metadata
  const [previewName, setPreviewName] = useState(parsed.title)
  const [previewMeal, setPreviewMeal] = useState<Recipe['meal'] | undefined>(
    parsed.meal as Recipe['meal'] | undefined
  )
  const [previewServes, setPreviewServes] = useState<number | null>(parsed.serves)
  const [previewPrepTime, setPreviewPrepTime] = useState<number | null>(parsed.prepTime)
  const [previewCookTime, setPreviewCookTime] = useState<number | null>(parsed.cookTime)

  const resolveIngredients = useCallback(async () => {
    setResolving(true)
    setError(null)
    try {
      const res = await fetch('/api/recipes/import/resolve-ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: parsed.ingredients }),
      })
      if (!res.ok) throw new Error('Failed to resolve ingredients')
      const data = await res.json()
      setResolved(data.results)
      setOverrides(
        data.results.map((r: ResolvedIngredient) => ({
          skipped: false,
          selectedFood: null,
          searchText: '',
          quantity: r.parsed.quantity,
          unit: r.parsed.unit,
        }))
      )
    } catch {
      setError('Failed to resolve ingredients. Please try again.')
    } finally {
      setResolving(false)
    }
  }, [parsed.ingredients])

  useEffect(() => {
    resolveIngredients()
  }, [resolveIngredients])

  function updateOverride(index: number, patch: Partial<IngredientOverride>) {
    setOverrides((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)))
  }

  async function handleCreate() {
    if (!previewName.trim()) return
    setSubmitting(true)

    try {
      type IngredientEntry = { food: Food; quantity: number; servingUnit: string; calories: number }
      const ingredients: IngredientEntry[] = resolved
        .map((r, i): IngredientEntry | null => {
          if (overrides[i].skipped) return null
          const food = overrides[i].selectedFood ?? r.food
          if (!food) return null
          // Commit the user-editable quantity/unit, falling back to the parse and then to the
          // Food's serving unit when the parsed unit was unrecognised (ADR-0024).
          const qty = overrides[i].quantity ?? 1
          const unit = overrides[i].unit ?? food.servingUnit
          const measurement = food.measurements?.find((m) => m.unit === unit)
          const calories =
            calculateCalories({
              baseCalories: food.calories || 0,
              baseServingSize: food.servingSize || 1,
              baseServingUnit: food.servingUnit,
              targetAmount: qty,
              targetUnit: unit,
              gramsPerUnit: measurement?.gramsPerUnit,
            }) ?? 0
          return { food, quantity: qty, servingUnit: unit, calories }
        })
        .filter((x): x is IngredientEntry => x !== null)

      const created = await apiCreateRecipe({
        name: previewName.trim(),
        meal: previewMeal,
        description: parsed.description ? `<p>${parsed.description}</p>` : '',
        ingredients,
        serves: previewServes ?? null,
        prepTime: previewPrepTime ?? null,
        cookTime: previewCookTime ?? null,
        sourceUrl: parsed.sourceUrl ?? null,
        sourceName: parsed.sourceName ?? null,
        date_added: new Date(),
        date_published: null,
        isPublic: false,
      })

      if (parsed.steps.length > 0) {
        await Promise.all(
          parsed.steps.map((stepText) =>
            apiCreateRecipeStep(created.shortId, { content: `<p>${stepText}</p>` })
          )
        )
      }

      addRecipeToStore(created)
      router.push(toRecipeUrl(created.shortId, created.name))
    } catch {
      setError('Failed to create recipe. Please try again.')
      setSubmitting(false)
    }
  }

  const hasUnresolved = resolved.some(
    (r, i) => !overrides[i].skipped && r.status !== 'matched' && !overrides[i].selectedFood
  )

  return (
    <div className="markdown-import">
      <div className="mi-preview">
        {/* Metadata */}
        <section className="mi-section">
          <h3 className="mi-section-title">Recipe Details</h3>
          <div className="mi-meta-grid">
            <label className="form-field form-field-full">
              <span className="field-label">Name</span>
              <InputText
                value={previewName}
                onChange={(e) => setPreviewName(e.target.value)}
                placeholder="Recipe name"
              />
            </label>
            <label className="form-field">
              <span className="field-label">Meal</span>
              <Dropdown
                value={previewMeal}
                options={MEAL_OPTIONS.map((m) => ({ label: m, value: m }))}
                onChange={(e) => setPreviewMeal(e.value)}
                placeholder="Select meal type"
              />
            </label>
            <label className="form-field">
              <span className="field-label">Serves</span>
              <InputNumber
                value={previewServes}
                onValueChange={(e) => setPreviewServes(e.value ?? null)}
                min={1}
                placeholder="e.g. 4"
              />
            </label>
            <label className="form-field">
              <span className="field-label">Prep time (min)</span>
              <InputNumber
                value={previewPrepTime}
                onValueChange={(e) => setPreviewPrepTime(e.value ?? null)}
                min={0}
                placeholder="e.g. 15"
              />
            </label>
            <label className="form-field">
              <span className="field-label">Cook time (min)</span>
              <InputNumber
                value={previewCookTime}
                onValueChange={(e) => setPreviewCookTime(e.value ?? null)}
                min={0}
                placeholder="e.g. 30"
              />
            </label>
          </div>
        </section>

        {/* Ingredients */}
        <section className="mi-section">
          <h3 className="mi-section-title">Ingredients</h3>
          {resolving && <p className="mi-resolving">Resolving ingredients…</p>}
          {!resolving && hasUnresolved && (
            <p className="mi-warning">
              Some ingredients need attention. Pick a match or click Skip for each highlighted row before creating the recipe.
            </p>
          )}
          <div className="mi-ingredient-list">
            {resolved.map((r, i) => {
              const override = overrides[i]
              const resolvedFood = override.selectedFood ?? r.food
              return (
                <IngredientRow
                  key={i}
                  resolved={r}
                  override={override}
                  resolvedFood={resolvedFood ?? null}
                  onOverride={(patch) => updateOverride(i, patch)}
                />
              )
            })}
          </div>
        </section>

        {/* Steps */}
        {parsed.steps.length > 0 && (
          <section className="mi-section">
            <h3 className="mi-section-title">Steps</h3>
            <ol className="mi-steps">
              {parsed.steps.map((step, i) => (
                <li key={i} className="mi-step">{step}</li>
              ))}
            </ol>
          </section>
        )}

        {error && <p className="mi-error" role="alert">{error}</p>}

        <div className="mi-preview-footer">
          <button type="button" className="ghost-button" onClick={onBack}>
            {backLabel}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleCreate}
            disabled={submitting || resolving || !previewName.trim() || hasUnresolved}
          >
            {submitting ? 'Creating…' : 'Create Recipe'}
          </button>
        </div>
      </div>
    </div>
  )
}

function IngredientRow({
  resolved,
  override,
  resolvedFood,
  onOverride,
}: {
  resolved: ResolvedIngredient
  override: IngredientOverride
  resolvedFood: Food | null
  onOverride: (patch: Partial<IngredientOverride>) => void
}) {
  const { status, parsed, candidates } = resolved
  const effectiveStatus = override.selectedFood ? 'matched' : status
  const localFoods = useFoodStore((state) => state.foods)

  // Unit options come from the resolved Food's Measurements plus the units its serving unit /
  // Density make convertible — the same set the Guided form offers. A parsed unit not in that
  // set is kept as an extra option so a valid custom unit isn't silently dropped. Until an
  // ingredient resolves to a Food we can't constrain the list, so we show the parsed unit as-is.
  const unitOptions = (() => {
    if (!resolvedFood) return []
    const stored = (resolvedFood.measurements || []).map((m) => m.unit)
    const allowed = getAllowedUnits(resolvedFood.servingUnit, resolvedFood.density).filter((u) => !stored.includes(u))
    const all = [...stored, ...allowed]
    const extra = override.unit && !all.includes(override.unit) ? [override.unit] : []
    return [...all, ...extra]
  })()
  const unitValue = override.unit ?? resolvedFood?.servingUnit ?? null

  return (
    <div className={`mi-ingredient-row mi-ingredient-row--${override.skipped ? 'skipped' : effectiveStatus}`}>
      <div className="mi-ingredient-raw">
        <InputNumber
          className="mi-qty-input"
          value={override.quantity}
          onValueChange={(e) => onOverride({ quantity: e.value ?? null })}
          min={0}
          disabled={override.skipped}
          aria-label="Quantity"
        />
        {resolvedFood ? (
          <Dropdown
            className="mi-unit-select"
            value={unitValue}
            options={unitOptions.map((u) => ({ label: u, value: u }))}
            onChange={(e) => onOverride({ unit: e.value })}
            disabled={override.skipped}
            aria-label="Unit"
          />
        ) : (
          <span className="mi-unit">{parsed.unit ?? ''}</span>
        )}
        <span className="mi-food-name">{parsed.foodName ?? resolved.raw}</span>
      </div>

      <div className="mi-ingredient-resolution">
        {!override.skipped && effectiveStatus === 'matched' && resolvedFood && (
          <span className="mi-badge mi-badge--matched">✓ {resolvedFood.name}</span>
        )}

        {!override.skipped && effectiveStatus === 'candidates' && !override.selectedFood && (
          <div className="mi-candidates-block">
            <div className="mi-candidates-header">
              <span className="mi-badge mi-badge--warn">No exact match</span>
              <div className="mi-candidates-carousel">
                {candidates?.map((c: Food) => (
                  <button
                    key={c.id}
                    type="button"
                    className="mi-candidate-btn"
                    onClick={() => onOverride({ selectedFood: c })}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
            <FoodSearch
              value={override.searchText}
              localFoods={localFoods}
              onChange={(food) => onOverride({ selectedFood: food, searchText: food.name })}
              placeholder="Or search for a food…"
              inputAriaLabel="Search food"
            />
          </div>
        )}

        {!override.skipped && effectiveStatus === 'unresolved' && !override.selectedFood && (
          <div className="mi-search">
            <span className="mi-badge mi-badge--error">Not found</span>
            <FoodSearch
              value={override.searchText}
              localFoods={localFoods}
              onChange={(food) => onOverride({ selectedFood: food, searchText: food.name })}
              placeholder="Search for a food…"
              inputAriaLabel="Search food"
            />
          </div>
        )}

        {override.skipped && (
          <span className="mi-badge mi-badge--skipped">Skipped</span>
        )}
      </div>

      <button
        type="button"
        className={`mi-skip-btn ${override.skipped ? 'mi-skip-btn--active' : ''}`}
        onClick={() => onOverride({ skipped: !override.skipped, selectedFood: null, searchText: '' })}
        aria-label={override.skipped ? 'Include ingredient' : 'Skip ingredient'}
      >
        {override.skipped ? 'Include' : 'Skip'}
      </button>
    </div>
  )
}
