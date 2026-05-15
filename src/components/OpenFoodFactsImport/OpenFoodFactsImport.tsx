'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import BarcodeScanner from '@/components/BarcodeScanner/BarcodeScanner'
import { apiSearchOpenFoodFacts, apiGetProductByBarcode, mapOFFProductToFood } from '@/lib/api/openFoodFacts'
import { apiCreateFood, apiFetchFoodByBarcode } from '@/lib/api/foods'
import type { OFFProduct } from '@/types/OpenFoodFacts'
import type { Food } from '@/types/Food'

interface OpenFoodFactsImportProps {
  visible: boolean
  onHide: () => void
  onImport: (food: Food) => void
}

type Tab = 'search' | 'barcode'

export default function OpenFoodFactsImport({ visible, onHide, onImport }: OpenFoodFactsImportProps) {
  const [activeTab, setActiveTab] = useState<Tab>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OFFProduct[]>([])
  const [barcodeResult, setBarcodeResult] = useState<OFFProduct | null>(null)
  const [localFoodResult, setLocalFoodResult] = useState<Food | null>(null)
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

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const products = await apiSearchOpenFoodFacts(query.trim())
        setResults(products)
        if (products.length === 0) setError('No results found. Try a different search term.')
      } catch {
        setError('Search failed. Please try again.')
      } finally {
        setLoading(false)
      }
    }, 400)

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [query])

  useEffect(() => {
    if (!visible) {
      setQuery('')
      setResults([])
      setBarcodeResult(null)
      setLocalFoodResult(null)
      setError(null)
      setLoading(false)
      setImportingCode(null)
      setActiveTab('search')
    }
  }, [visible])

  async function handleBarcodeDetected(code: string) {
    setLoading(true)
    setError(null)
    setBarcodeResult(null)
    setLocalFoodResult(null)
    try {
      const local = await apiFetchFoodByBarcode(code)
      if (local) {
        setLocalFoodResult(local)
        return
      }
      const product = await apiGetProductByBarcode(code)
      if (!product) {
        setError(`No product found for barcode ${code}.`)
      } else {
        setBarcodeResult(product)
      }
    } catch {
      setError('Barcode lookup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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
    <Dialog
      visible={visible}
      onHide={onHide}
      header="Import from OpenFoodFacts"
      modal
      className="off-import-dialog"
      style={{ width: '560px', maxWidth: '95vw' }}
    >
      <div className="off-tabs">
        <button
          type="button"
          className={`off-tab ${activeTab === 'search' ? 'is-active' : ''}`}
          onClick={() => { setActiveTab('search'); setError(null) }}
        >
          Search by name
        </button>
        <button
          type="button"
          className={`off-tab ${activeTab === 'barcode' ? 'is-active' : ''}`}
          onClick={() => { setActiveTab('barcode'); setError(null) }}
        >
          Scan barcode
        </button>
      </div>

      {activeTab === 'search' && (
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
      )}

      {activeTab === 'barcode' && (
        <div className="off-panel">
          {error && <p className="off-error">{error}</p>}
          {loading && <p className="off-status">Looking up barcode…</p>}
          {localFoodResult && (
            <>
              <div className="off-result off-result-local">
                <div className="off-result-info">
                  <span className="off-result-name">{localFoodResult.name}</span>
                  <span className="off-result-meta">
                    {localFoodResult.calories} cal &middot; P {localFoodResult.protein}g &middot; C {localFoodResult.carbs}g &middot; F {localFoodResult.fat}g
                  </span>
                </div>
                <span className="off-in-library">Already in library</span>
              </div>
              <button
                type="button"
                className="ghost-button off-scan-again"
                onClick={() => { setLocalFoodResult(null); setError(null) }}
              >
                Scan another
              </button>
            </>
          )}
          {barcodeResult ? (
            <>
              <div className="off-results">{renderProduct(barcodeResult)}</div>
              <button
                type="button"
                className="ghost-button off-scan-again"
                onClick={() => { setBarcodeResult(null); setError(null) }}
              >
                Scan another
              </button>
            </>
          ) : (
            !loading && <BarcodeScanner onDetected={handleBarcodeDetected} />
          )}
        </div>
      )}
    </Dialog>
  )
}
