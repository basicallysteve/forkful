'use client'
import { useState, useMemo } from 'react'
import { InputText } from 'primereact/inputtext'
import { apiScrapeRecipeFromUrl } from '@/lib/api/recipes'
import RecipeImportPreview from './RecipeImportPreview'
import type { ParsedRecipe } from '@/utils/recipeMarkdownParser'
import './recipeImporter.scss'

type Stage = 'url' | 'scraping' | 'preview'

export default function RecipeImporter() {
  const [url, setUrl] = useState('')
  const [stage, setStage] = useState<Stage>('url')
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Keep the input verbatim so the field stays fully editable; only add a default scheme when
  // deriving the URL we validate and submit, so typing/clearing/pasting isn't fought against.
  const normalizedUrl = useMemo(() => {
    const trimmed = url.trim()
    if (!trimmed) return ''
    return /^https?:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed
  }, [url])

  const isValidUrl = useMemo(() => {
    if (!normalizedUrl) return false
    try {
      new URL(normalizedUrl)
      return true
    } catch {
      return false
    }
  }, [normalizedUrl])

  function handleUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUrl(e.target.value)
  }

  async function handleImport() {
    setError(null)
    setStage('scraping')
    try {
      const importedRecipe = await apiScrapeRecipeFromUrl(normalizedUrl)
      setParsed(importedRecipe)
      setStage('preview')
    } catch {
      setError("Couldn't import a recipe from that URL. Check the link or try another site.")
      setStage('url')
    }
  }

  if (stage === 'preview' && parsed) {
    return <RecipeImportPreview parsed={parsed} onBack={() => setStage('url')} />
  }

  const scraping = stage === 'scraping'

  return (
    <div className="import-panel">
      <InputText
        value={url}
        onChange={handleUrlChange}
        placeholder="https://example.com/recipe"
        disabled={scraping}
      />
      {error && <p className="import-error" role="alert">{error}</p>}
      <div className="actions">
        <button
          disabled={!isValidUrl || scraping}
          onClick={handleImport}
          type="button"
          className="primary-button import-button"
        >
          {scraping ? 'Importing…' : 'Import'}
        </button>
      </div>
    </div>
  )
}
