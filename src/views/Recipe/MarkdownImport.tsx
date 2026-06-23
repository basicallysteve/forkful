'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Dropdown } from 'primereact/dropdown'
import { InputNumber } from 'primereact/inputnumber'
import { InputText } from 'primereact/inputtext'
import { recipeLanguage } from '@/utils/recipeLanguage'
import { parseRecipeMarkdown } from '@/utils/recipeMarkdownParser'
import { useRecipeStore } from '@/stores/recipes'
import { apiCreateRecipe, apiCreateRecipeStep } from '@/lib/api/recipes'
import { apiFetchFoods } from '@/lib/api/foods'
import { toRecipeUrl } from '@/utils/slug'
import { calculateCalories } from '@/utils/unitConversion'
import FoodSearch from '@/components/FoodSearch/FoodSearch'
import { useFoodStore } from '@/stores/food'
import type { Food } from '@/types/Food'
import type { Recipe } from '@/types/Recipe'
import type { ResolvedIngredient } from '@/types/RecipeImport'
import type { ParsedRecipe } from '@/utils/recipeMarkdownParser'

const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr: false })

const MEAL_OPTIONS: Recipe['meal'][] = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert']

const TEMPLATE = `# My Recipe
meal: Dinner
serves: 4
prepTime: 15
cookTime: 30

## Description
A brief description of your recipe.

## Ingredients
- 500g chicken breast
- 2 cup rice
- 1 tsp salt

## Steps
1. Prepare the ingredients.
2. Cook according to your method.
3. Serve and enjoy.
`

type IngredientOverride = {
  skipped: boolean
  selectedFood: Food | null
  searchText: string
}

type Mode = 'editor' | 'resolving' | 'preview'

export default function MarkdownImport() {
  const router = useRouter()
  const addRecipeToStore = useRecipeStore((state) => state.addRecipe)
  const setFoods = useFoodStore((state) => state.setFoods)

  useEffect(() => {
    apiFetchFoods().then(setFoods).catch(() => {})
  }, [setFoods])

  const [markdown, setMarkdown] = useState(TEMPLATE)
  const [mode, setMode] = useState<Mode>('editor')
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null)
  const [resolved, setResolved] = useState<ResolvedIngredient[]>([])
  const [overrides, setOverrides] = useState<IngredientOverride[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Editable metadata in preview
  const [previewName, setPreviewName] = useState('')
  const [previewMeal, setPreviewMeal] = useState<Recipe['meal'] | undefined>(undefined)
  const [previewServes, setPreviewServes] = useState<number | null>(null)
  const [previewPrepTime, setPreviewPrepTime] = useState<number | null>(null)
  const [previewCookTime, setPreviewCookTime] = useState<number | null>(null)

  const extensions = [recipeLanguage]

  const handleParseAndPreview = useCallback(async () => {
    setError(null)
    setMode('resolving')

    const p = parseRecipeMarkdown(markdown)
    setParsed(p)
    setPreviewName(p.title)
    setPreviewMeal(p.meal as Recipe['meal'] | undefined)
    setPreviewServes(p.serves)
    setPreviewPrepTime(p.prepTime)
    setPreviewCookTime(p.cookTime)

    try {
      const res = await fetch('/api/recipes/import/resolve-ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: p.ingredients }),
      })
      if (!res.ok) throw new Error('Failed to resolve ingredients')
      const data = await res.json()
      setResolved(data.results)
      setOverrides(
        data.results.map(() => ({ skipped: false, selectedFood: null, searchText: '' }))
      )
      setMode('preview')
    } catch {
      setError('Failed to resolve ingredients. Please try again.')
      setMode('editor')
    }
  }, [markdown])

  function updateOverride(index: number, patch: Partial<IngredientOverride>) {
    setOverrides((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)))
  }

  async function handleCreate() {
    if (!parsed || !previewName.trim()) return
    setSubmitting(true)

    try {
      type IngredientEntry = { food: Food; quantity: number; servingUnit: string; calories: number }
      const ingredients: IngredientEntry[] = resolved
        .map((r, i): IngredientEntry | null => {
          if (overrides[i].skipped) return null
          const food = overrides[i].selectedFood ?? r.food
          if (!food) return null
          const qty = r.parsed.quantity ?? 1
          const unit = r.parsed.unit ?? food.servingUnit
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

  if (mode === 'editor' || mode === 'resolving') {
    return (
      <div className="markdown-import">
        <div className="mi-editor-wrap">
          <CodeMirror
            value={markdown}
            onChange={setMarkdown}
            extensions={extensions}
            theme="dark"
            height="420px"
            placeholder={TEMPLATE}
            basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: true }}
          />
        </div>
        {error && <p className="mi-error" role="alert">{error}</p>}
        <div className="mi-editor-footer">
          <button
            type="button"
            className="primary-button"
            onClick={handleParseAndPreview}
            disabled={mode === 'resolving' || !markdown.trim()}
          >
            {mode === 'resolving' ? 'Resolving ingredients…' : 'Parse & Preview'}
          </button>
        </div>
      </div>
    )
  }

  // Preview mode
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
        {resolved.length > 0 && (
          <section className="mi-section">
            <h3 className="mi-section-title">Ingredients</h3>
            {hasUnresolved && (
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
        )}

        {/* Steps */}
        {parsed?.steps && parsed.steps.length > 0 && (
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
          <button
            type="button"
            className="ghost-button"
            onClick={() => { setMode('editor'); setError(null) }}
          >
            ← Edit Markdown
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleCreate}
            disabled={submitting || !previewName.trim() || hasUnresolved}
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

  return (
    <div className={`mi-ingredient-row mi-ingredient-row--${override.skipped ? 'skipped' : effectiveStatus}`}>
      <div className="mi-ingredient-raw">
        <span className="mi-qty">{parsed.quantity ?? '?'}</span>
        <span className="mi-unit">{parsed.unit ?? ''}</span>
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
