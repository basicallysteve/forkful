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

  const isValidUrl = useMemo(() => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }, [url])

  function handleUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    let newUrl = e.target.value
    if (!newUrl?.startsWith?.('http://') && !newUrl?.startsWith?.('https://')) {
      newUrl = 'https://' + newUrl
    }
    setUrl(newUrl)
  }

  async function handleImport() {
    setError(null)
    setStage('scraping')
    try {
      const importedRecipe = await apiScrapeRecipeFromUrl(url)
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
