'use client'

import Link from 'next/link'
import { Card } from 'primereact/card'
import { Checkbox } from 'primereact/checkbox'
import { sanitizeRichText } from '@/lib/sanitize'
import { toRecipeUrl } from '@/utils/slug'
import type { Recipe } from '@/types/Recipe'
import StatusDot from '@/components/StatusLegend/StatusDot'
import './recipe-card.scss'

interface RecipeCardProps {
  recipe: Recipe
  selected?: boolean
  onSelect?: (id: number) => void
}

function getDaysOld(date?: Date | null): string {
  if (!date) return ''
  const now = new Date()
  const dateObj = new Date(date)
  const diffTime = Math.abs(now.getTime() - dateObj.getTime())
  const xDaysOld = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return xDaysOld > 1 ? `${xDaysOld} days ago` : 'Today'
}

export default function RecipeCard({ recipe, selected, onSelect }: RecipeCardProps) {
  return (
    <Card className={`recipe-card${selected ? ' is-selected' : ''}`}>
      {onSelect && (
        <div className="card-checkbox">
          <Checkbox
            className="recipe-checkbox"
            checked={selected ?? false}
            onChange={() => onSelect(recipe.id)}
            aria-label={`Select ${recipe.name}`}
          />
        </div>
      )}
      {recipe.meal && <span className="pill pill-ghost card-meal-tag">{recipe.meal}</span>}
      <Link href={toRecipeUrl(recipe.shortId, recipe.name)} className="card-content">
        <div className="card-header">
          <h3 className="card-title">{recipe.name}</h3>
          {recipe.date_published === null && (
            <div className="card-badges">
              <StatusDot variant="unpublished" label="Unpublished" />
            </div>
          )}
        </div>
        <div
          className="card-description"
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(recipe.description) }}
        />
        <div className="card-footer">
          <span className="card-meta">
            {recipe.ingredientCount ?? recipe.ingredients.length} {(recipe.ingredientCount ?? recipe.ingredients.length) === 1 ? 'ingredient' : 'ingredients'}
          </span>
          {recipe.isPublic && (recipe.viewCount ?? 0) > 0 && (
            <span className="card-meta">
              {recipe.viewCount} {recipe.viewCount === 1 ? 'view' : 'views'}
            </span>
          )}
          <span className="card-meta">{getDaysOld(recipe.date_published)}</span>
        </div>
      </Link>
    </Card>
  )
}
