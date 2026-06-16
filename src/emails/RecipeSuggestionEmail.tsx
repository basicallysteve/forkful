import { BaseEmail } from './BaseEmail'

/** Strip HTML tags so rich-text descriptions render safely as plain text in email. */
function stripHtml(html: string): string {
  // Iteratively remove tags until the string stabilises — prevents bypass via nested
  // brackets like <<script>script> where one pass would leave a valid <script> tag.
  let result = html
  let prev: string
  do {
    prev = result
    result = result.replace(/<[^>]*>/g, '')
  } while (result !== prev)
  // Decode HTML entities. &amp; MUST come last to prevent double-unescaping
  // (e.g. &amp;lt; → &lt; → < if decoded in the wrong order).
  return result
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

interface SuggestedRecipe {
  name: string
  description: string | null
  cuisineType: string | null
  slug: string
}

interface Props {
  username: string
  recipes: SuggestedRecipe[]
  baseUrl: string
  trackingPixelUrl?: string
}

export function RecipeSuggestionEmail({ username, recipes, baseUrl, trackingPixelUrl }: Props) {
  return (
    <BaseEmail
      subject="Recipe ideas picked for you"
      previewText={`Here are some recipe ideas we thought you might enjoy, ${username}.`}
      variant="functional"
      trackingPixelUrl={trackingPixelUrl}
    >
      <p style={{ margin: '0 0 8px', fontSize: 13, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Recipe Ideas
      </p>
      <h1 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 700, color: '#09090b' }}>
        Hi {username}, here are some ideas for this week
      </h1>

      <p style={{ margin: '0 0 24px' }}>
        We picked a few public recipes from Forkful that we thought you might enjoy.
      </p>

      {recipes.map((recipe, i) => (
        <table key={i} cellPadding={0} cellSpacing={0} style={{ width: '100%', marginBottom: 16, borderRadius: 8, border: '1px solid #e4e4e7', overflow: 'hidden' }}>
          <tbody>
            <tr>
              <td style={{ padding: '16px' }}>
                {recipe.cuisineType && (
                  <p style={{ margin: '0 0 4px', fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                    {recipe.cuisineType}
                  </p>
                )}
                <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#09090b' }}>
                  <a href={`${baseUrl}/recipes/${recipe.shortId}/${recipe.slug}`} style={{ color: '#09090b', textDecoration: 'none' }}>
                    {recipe.name}
                  </a>
                </p>
                {recipe.description && (
                  <p style={{ margin: '0 0 12px', fontSize: 13, color: '#71717a', lineHeight: 1.5 }}>
                    {(() => { const t = stripHtml(recipe.description); return t.length > 120 ? `${t.slice(0, 120)}…` : t })()}
                  </p>
                )}
                <a
                  href={`${baseUrl}/recipes/${recipe.shortId}/${recipe.slug}`}
                  style={{ fontSize: 13, color: '#10b981', fontWeight: 600, textDecoration: 'none' }}
                >
                  View recipe →
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      ))}

      <p style={{ margin: '24px 0 0', fontSize: 13, color: '#71717a' }}>
        You can adjust how often you receive recipe suggestions in your{' '}
        <a href={`${baseUrl}/profile`} style={{ color: '#10b981' }}>account settings</a>.
      </p>
    </BaseEmail>
  )
}
