'use client'

import { useRef, useState, useEffect } from 'react'
import { AutoComplete } from 'primereact/autocomplete'
import type { AutoCompleteCompleteEvent, AutoCompleteSelectEvent } from 'primereact/autocomplete'
import { SelectButton } from 'primereact/selectbutton'
import { apiFetchProducts, apiFetchProductByBarcode, apiCreateProduct } from '@/lib/api/products'
import { apiSearchOpenFoodFacts, mapOFFProductToProduct } from '@/lib/api/openFoodFacts'
import { mapUSDABrandedToProduct, importUSDABrandedProduct } from '@/lib/usda'
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
  const latestQueryRef = useRef<string>('')
  const acRef = useRef<AutoComplete>(null)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  async function handleComplete(e: AutoCompleteCompleteEvent) {
    const query = e.query.trim()
    if (!query) {
      setSuggestions([])
      return
    }

    latestQueryRef.current = query
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (latestQueryRef.current !== query) return

      try {
        // Fetch local, USDA branded, and OFF in parallel — USDA shown before OFF
        const [localResult, usdaResult, offResult] = await Promise.allSettled([
          apiFetchProducts({ search: query }),
          fetch(`/api/usda/search?q=${encodeURIComponent(query)}&type=branded`).then(r => r.ok ? r.json() : { products: [] }),
          apiSearchOpenFoodFacts(query),
        ])

        if (latestQueryRef.current !== query) return

        const localItems = localResult.status === 'fulfilled' ? localResult.value.slice(0, 6) : []
        const usdaItems: USDABrandedItem[] = usdaResult.status === 'fulfilled'
          ? ((usdaResult.value.products ?? []) as USDABrandedItem[]).slice(0, 8)
          : []
        const offItems: OFFProduct[] = offResult.status === 'fulfilled' ? offResult.value : []

        const localNames = new Set(localItems.map(p => p.name.toLowerCase()))
        const filteredUSDA = usdaItems.filter(i => !localNames.has(i.description.toLowerCase()))
        const takenNames = new Set([...localNames, ...filteredUSDA.map(i => i.description.toLowerCase())])
        const filteredOFF = offItems
          .filter(p => p.product_name && !takenNames.has(p.product_name.toLowerCase()))
          .slice(0, 4)

        // USDA results first, then OFF, merged under a single "Online" group
        const onlineItems: SuggestionItem[] = [
          ...filteredUSDA.map(i => ({ kind: 'usda' as const, item: i })),
          ...filteredOFF.map(p => ({ kind: 'off' as const, product: p })),
        ]

        const groups: SuggestionGroup[] = []
        if (localItems.length > 0) {
          groups.push({ label: 'In your library', items: localItems.map(p => ({ kind: 'local' as const, product: p })) })
        }
        if (onlineItems.length > 0) {
          groups.push({ label: 'Online', items: onlineItems })
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
      const productData: Omit<Product, 'id'> = item.kind === 'usda'
        ? await importUSDABrandedProduct(item.item)
        : mapOFFProductToProduct(item.product)
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
      // Single server call: checks local DB, falls back to OFF, auto-creates if needed
      const product = await apiFetchProductByBarcode(code)
      if (!product) {
        setBarcodeError(`No product found for barcode ${code}.`)
        return
      }
      onChange(product)
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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const val = e.value as any
              if (typeof val === 'string') {
                setInputValue(val)
                if (!val.trim()) setSuggestions([])
              }
            }}
            field="name"
            optionGroupLabel="label"
            optionGroupChildren="items"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            optionGroupTemplate={groupTemplate as any}
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
