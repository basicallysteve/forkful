import type { Recipe } from '@/types/Recipe'

/**
 * CSS selector marking the paywalled region of a recipe page. Referenced by the
 * Recipe JSON-LD `hasPart` annotation so search engines treat the Signup Wall as
 * declared metered content rather than cloaking (Google flexible sampling). The
 * class is applied to the withheld region in both the full and gated renders.
 */
export const PAYWALLED_SELECTOR = '.recipe-paywalled'

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Minutes → ISO 8601 duration (e.g. 90 → "PT1H30M"). Returns undefined for <= 0. */
function isoDuration(minutes?: number | null): string | undefined {
  if (minutes == null || minutes <= 0) return undefined
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `PT${hours ? `${hours}H` : ''}${mins ? `${mins}M` : ''}`
}

/**
 * Build schema.org Recipe JSON-LD for a recipe detail page.
 *
 * Always declares the recipe as metered (`isAccessibleForFree: false` + a
 * `hasPart` paywall annotation) so the Crawler Exemption reads as flexible
 * sampling, not cloaking. Ingredients and steps are included only when present
 * on the recipe — i.e. the full render served to crawlers and under-limit
 * visitors; the gated summary payload omits them. See ADR-0020.
 */
export function buildRecipeJsonLd(recipe: Recipe): Record<string, unknown> {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.name,
    description: stripHtml(recipe.description),
    isAccessibleForFree: false,
    hasPart: {
      '@type': 'WebPageElement',
      isAccessibleForFree: false,
      cssSelector: PAYWALLED_SELECTOR,
    },
  }

  if (recipe.meal) jsonLd.recipeCategory = recipe.meal
  if (recipe.cuisineType) jsonLd.recipeCuisine = recipe.cuisineType
  if (recipe.serves != null) jsonLd.recipeYield = `${recipe.serves} servings`
  if (recipe.dietaryTags && recipe.dietaryTags.length > 0) jsonLd.keywords = recipe.dietaryTags.join(', ')

  const prepTime = isoDuration(recipe.prepTime)
  const cookTime = isoDuration(recipe.cookTime)
  const totalTime = isoDuration(recipe.totalTime)
  if (prepTime) jsonLd.prepTime = prepTime
  if (cookTime) jsonLd.cookTime = cookTime
  if (totalTime) jsonLd.totalTime = totalTime

  if (recipe.ingredients.length > 0) {
    jsonLd.recipeIngredient = recipe.ingredients.map((i) =>
      `${i.quantity} ${i.servingUnit ?? ''} ${i.food.name}`.replace(/\s+/g, ' ').trim(),
    )
  }

  const steps = recipe.steps ?? []
  if (steps.length > 0) {
    jsonLd.recipeInstructions = steps.map((s) => ({
      '@type': 'HowToStep',
      ...(s.title ? { name: s.title } : {}),
      text: stripHtml(s.content),
    }))
  }

  return jsonLd
}
