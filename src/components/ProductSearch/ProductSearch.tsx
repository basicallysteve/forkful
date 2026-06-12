'use client'

import { useRef, useState, useEffect } from 'react'
import { AutoComplete } from 'primereact/autocomplete'
import type { AutoCompleteCompleteEvent, AutoCompleteSelectEvent } from 'primereact/autocomplete'
import { SelectButton } from 'primereact/selectbutton'
import { apiFetchProducts, apiFetchProductByBarcode, apiCreateProduct } from '@/lib/api/products'
import { apiSearchOpenFoodFacts, apiGetProductByBarcode, mapOFFProductToProduct } from '@/lib/api/openFoodFacts'
import { mapUSDABrandedToProduct } from '@/lib/usda'
import type { Product } from '@/types/Product'
import type { USDABrandedItem } from '@/lib/usda'
import type { OFFProduct } from '@/types/OpenFoodFacts'
import BarcodeScanner from '@/components/BarcodeScanner/BarcodeScanner'
import './product-search.scss'

type Tab = 'search' | 'barcode'

type SuggestionGroup = {
  label: string
  items: SuggestionItem[]
}

type SuggestionItem =
  | { kind: 'local'; product: Product }
  | { kind: 'usda'; item: USDABrandedItem }
  | { kind: 'off'; product: OFFProduct }

function itemName(s: SuggestionItem): string {
  if (s.kind === 'local') return s.product.name
  if (s.kind === 'usda') return s.item.description
  return s.product.product_name
}

function itemMacros(s: SuggestionItem): string {
  if (s.kind === 'local') {
    return `${s.product.calories} cal · P ${s.product.protein}g · C ${s.product.carbs}g · F ${s.product.fat}g`
  }
  if (s.kind === 'usda') {
    const p = mapUSDABrandedToProduct(s.item)
    return `${p.calories} cal · P ${p.protein}g · C ${p.carbs}g · F ${p.fat}g`
  }
  const p = mapOFFProductToProduct(s.product)
  return `${p.calories} cal · P ${p.protein}g · C ${p.carbs}g · F ${p.fat}g`
}

interface ProductSearchProps {
  value: string
  onChange: (product: Product) => void
  placeholder?: string
  inputAriaLabel?: string
}

export default function ProductSearch({ value, onChange, placeholder, inputAriaLabel }: ProductSearchProps) {
  const [inputValue, setInputValue] = useState(value)
  const [activeTab, setActiveTab] = useState<Tab>('search')
  const [suggestions, setSuggestions] = useState<SuggestionGroup[]>([])
  const [importing, setImporting] = useState(false)
  const [barcodeLoading, setBarcodeLoading] = useState(false)
  const [barcodeError, setBarcodeError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const acRef = useRef<AutoComplete>(null)

  // Sync display text when parent commits a new selection (product picked or cleared)
  useEffect(() => {
    setInputValue(value)
  }, [value])

  async function handleComplete(e: AutoCompleteCompleteEvent) {
    const query = e.query.trim()
    if (!query) {
      setSuggestions([])
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const [localProducts, usdaRes] = await Promise.all([
          apiFetchProducts({ search: query }),
          fetch(`/api/usda/search?q=${encodeURIComponent(query)}&type=branded`).then(r => r.ok ? r.json() : { products: [] }),
        ])

        const localItems = localProducts.slice(0, 6)
        const localNames = new Set(localItems.map(p => p.name.toLowerCase()))
        const usdaItems: USDABrandedItem[] = ((usdaRes.products ?? []) as USDABrandedItem[])
          .filter(i => !localNames.has(i.description.toLowerCase()))
          .slice(0, 8)

        const groups: SuggestionGroup[] = []
        if (localItems.length > 0) {
          groups.push({ label: 'In your library', items: localItems.map(p => ({ kind: 'local' as const, product: p })) })
        }
        if (usdaItems.length > 0) {
          groups.push({ label: 'From USDA Branded', items: usdaItems.map(i => ({ kind: 'usda' as const, item: i })) })
        }

        // OFF fallback if USDA returns fewer than 3 results
        if (usdaItems.length < 3) {
          try {
            const offProducts = await apiSearchOpenFoodFacts(query)
            const offItems = offProducts.slice(0, 5)
            if (offItems.length > 0) {
              groups.push({ label: 'Open Food Facts', items: offItems.map(p => ({ kind: 'off' as const, product: p })) })
            }
          } catch {
            // OFF fallback is best-effort
          }
        }

        setSuggestions(groups)
      } catch {
        setSuggestions([])
      }
    }, 400)
  }

  async function handleSelect(e: AutoCompleteSelectEvent) {
    const item = e.value as SuggestionItem
    if (item.kind === 'local') {
      setInputValue(item.product.name)
      onChange(item.product)
      return
    }

    setImporting(true)
    try {
      let productData: Omit<Product, 'id'>
      if (item.kind === 'usda') {
        productData = mapUSDABrandedToProduct(item.item)
      } else {
        productData = mapOFFProductToProduct(item.product)
      }
      const created = await apiCreateProduct(productData)
      setInputValue(created.name)
      onChange(created)
    } catch {
      // Import failed — no-op
    } finally {
      setImporting(false)
    }
  }

  async function handleBarcodeDetected(code: string) {
    setBarcodeLoading(true)
    setBarcodeError(null)
    try {
      // 1. Check local products table
      const local = await apiFetchProductByBarcode(code)
      if (local) {
        onChange(local)
        return
      }
      // 2. Fall back to Open Food Facts
      const offProduct = await apiGetProductByBarcode(code)
      if (!offProduct) {
        setBarcodeError(`No product found for barcode ${code}.`)
        return
      }
      const productData = mapOFFProductToProduct(offProduct)
      const created = await apiCreateProduct(productData)
      onChange(created)
    } catch {
      setBarcodeError('Barcode lookup failed. Please try again.')
    } finally {
      setBarcodeLoading(false)
    }
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    acRef.current?.search(e, inputValue)
  }

  const itemTemplate = (item: SuggestionItem) => (
    <div className="product-search-item">
      <span className="product-search-item-name">{itemName(item)}</span>
      <span className="product-search-item-meta">{itemMacros(item)}</span>
    </div>
  )

  const groupTemplate = (group: SuggestionGroup) => (
    <div className="product-search-group-label">{group.label}</div>
  )

  const tabOptions = [
    { label: 'Search by name', value: 'search' },
    { value: 'barcode', icon: 'pi pi-barcode' },
  ]

  const tabTemplate = (option: { label?: string; value: string; icon?: string }) => (
    option.icon
      ? <i className={option.icon} title="Scan barcode" />
      : <span>{option.label}</span>
  )

  return (
    <div className="product-search">
      <SelectButton
        value={activeTab}
        onChange={(e) => {
          const next = e.value as Tab
          if (!next) return
          setActiveTab(next)
          setBarcodeError(null)
        }}
        options={tabOptions}
        optionLabel="label"
        optionValue="value"
        itemTemplate={tabTemplate}
        className="product-search-tabs"
      />

      {activeTab === 'search' && (
        <div className="product-search-panel">
          <AutoComplete
            ref={acRef}
            value={inputValue}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            suggestions={suggestions as any[]}
            completeMethod={handleComplete}
            onSelect={handleSelect}
            onFocus={handleFocus}
            onChange={(e) => {
              if (typeof e.value === 'string') {
                setInputValue(e.value)
                if (!e.value.trim()) setSuggestions([])
              }
            }}
            field="name"
            optionGroupLabel="label"
            optionGroupChildren="items"
            optionGroupTemplate={groupTemplate}
            itemTemplate={itemTemplate}
            placeholder={importing ? 'Importing…' : placeholder}
            disabled={importing}
            delay={0}
            inputClassName="text-input"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pt={{ input: { 'aria-label': inputAriaLabel } as any }}
          />
        </div>
      )}

      {activeTab === 'barcode' && (
        <div className="product-search-panel">
          {barcodeError && <p className="product-search-error">{barcodeError}</p>}
          {barcodeLoading && <p className="product-search-status">Looking up barcode…</p>}
          {!barcodeLoading && (
            <BarcodeScanner onDetected={handleBarcodeDetected} />
          )}
        </div>
      )}
    </div>
  )
}
