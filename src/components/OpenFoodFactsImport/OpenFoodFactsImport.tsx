'use client'

import { useEffect, useRef, useState } from 'react'
import Modal from '@/components/Modal/Modal'
import { InputText } from 'primereact/inputtext'
import { apiSearchOpenFoodFacts, mapOFFProductToFood } from '@/lib/api/openFoodFacts'
import { apiCreateFood } from '@/lib/api/foods'
import type { OFFProduct } from '@/types/OpenFoodFacts'
import type { Food } from '@/types/Food'

interface OpenFoodFactsImportProps {
  visible: boolean
  onHide: () => void
  onImport: (food: Food) => void
}

export default function OpenFoodFactsImport({ visible, onHide, onImport }: OpenFoodFactsImportProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OFFProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importingCode, setImportingCode] = useState<string | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([])
      setError(null)
      return
    }

    let cancelled = false

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const products = await apiSearchOpenFoodFacts(query.trim())
        if (!cancelled) {
          setResults(products)
          if (products.length === 0) setError('No results found. Try a different search term.')
        }
      } catch {
        if (!cancelled) setError('Search failed. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 400)

    return () => {
      cancelled = true
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [query])

  useEffect(() => {
    if (!visible) {
      setQuery('')
      setResults([])
      setError(null)
      setLoading(false)
      setImportingCode(null)
    }
  }, [visible])

  async function handleImport(product: OFFProduct) {
    setImportingCode(product.code)
    setError(null)
    try {
      const foodData = mapOFFProductToFood(product)
      const created = await apiCreateFood(foodData)
      onImport(created)
      onHide()
    } catch {
      setError(`Failed to import "${product.product_name}". It may already exist in your library.`)
      setImportingCode(null)
    }
  }

  function renderProduct(product: OFFProduct) {
    const food = mapOFFProductToFood(product)
    const isImporting = importingCode === product.code

    return (
      <div key={product.code} className="off-result">
        <div className="off-result-info">
          <span className="off-result-name">{product.product_name}</span>
          <span className="off-result-meta">
            {food.calories} cal &middot; P {food.protein}g &middot; C {food.carbs}g &middot; F {food.fat}g
            <span className="off-result-serving"> &mdash; per {food.servingSize}g serving</span>
          </span>
        </div>
        <button
          type="button"
          className="primary-button"
          disabled={isImporting}
          onClick={() => handleImport(product)}
        >
          {isImporting ? 'Importing…' : 'Import'}
        </button>
      </div>
    )
  }

  return (
    <Modal
      visible={visible}
      onHide={onHide}
      header="Import from OpenFoodFacts"
      className="off-import-dialog"
      style={{ width: '560px', maxWidth: '95vw' }}
    >
      <div className="off-panel">
        <InputText
          className="off-search-input"
          placeholder="Search foods, e.g. 'Greek yogurt'…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {loading && <p className="off-status">Searching…</p>}
        {error && <p className="off-error">{error}</p>}
        {results.length > 0 && (
          <div className="off-results">{results.map(renderProduct)}</div>
        )}
      </div>
    </Modal>
  )
}
