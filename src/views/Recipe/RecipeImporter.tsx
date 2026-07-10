'use client'
import { useState, useMemo } from 'react'
import { InputText } from 'primereact/inputtext'
import { apiScrapeRecipeFromUrl } from '@/lib/api/recipes'
// import { useMask } from '@primereact/hooks'
import './recipeImporter.scss'
export default function RecipeImporter({ onImport }: { onImport: (importedRecipe: any) => void }) {
    // const {ref: urlMask} = useMask({ mask: 'https://*.*/*', placeholder: 'https://example.com/recipe' })
    const [url, setUrl] = useState('')

    const isValidUrl = useMemo(() => {
        try {
            new URL(url)
            return true
        } catch (e) {
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
        try {
            const importedRecipe = await apiScrapeRecipeFromUrl(url)
            onImport(importedRecipe)
        } catch (error) {
            console.error('Failed to import recipe:', error)
        }
    }
    return (
    <div className="import-panel">
      <InputText value={url} onChange={handleUrlChange} placeholder="https://example.com/recipe" />
      <div className="actions">
        <button disabled={!isValidUrl} onClick={handleImport} type="button" className="primary-button import-button">Import</button>
      </div>
    </div>
  )
}