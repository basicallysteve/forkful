'use client'

import { useEffect, useMemo, useState } from 'react'
import FoodSearch from '@/components/FoodSearch/FoodSearch'
import ProductSearch from '@/components/ProductSearch/ProductSearch'
import { useFoodStore } from '@/stores/food'
import { useShoppingListStore } from '@/stores/shoppingList'
import { apiCreateShoppingListItem } from '@/lib/api/shoppingList'
import { apiFetchFoods } from '@/lib/api/foods'
import { formatUnitForAmount, preferredShoppingUnit, shoppingUnitOptions } from '@/utils/unitConversion'
import type { Food } from '@/types/Food'
import type { Product } from '@/types/Product'
import type { ShoppingListItem, ShoppingListItemSourceType } from '@/types/ShoppingList'
import { InputNumber } from 'primereact/inputnumber'
import type { InputNumberValueChangeEvent } from 'primereact/inputnumber'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { ListBox } from 'primereact/listbox'
import { Checkbox } from 'primereact/checkbox'

type ShoppingListViewProps = {
  // Optional: the server no longer ships the whole catalog. When omitted, the view loads it lazily.
  initialFoods?: Food[]
  initialItems: ShoppingListItem[]
}

type AddVariant = Extract<ShoppingListItemSourceType, 'food' | 'product' | 'freeform'>

const VARIANT_LABELS: Record<AddVariant, string> = {
  food: 'Food',
  product: 'Product',
  freeform: 'Freeform',
}

// A source's shopping units come from its Measurements, falling back to its serving unit.
function getSourceUnits(source: Food | Product | null): string[] {
  if (!source) return []
  const units = source.measurements.map((measurement) => measurement.unit)
  return units.length > 0 ? units : [source.servingUnit].filter(Boolean)
}

// Amount only reads on the list when it carries meaning: with a unit, or when it isn't a bare "1".
function itemQuantityLabel(item: ShoppingListItem): string {
  if (item.unit) return `${item.amount} ${formatUnitForAmount(item.amount, item.unit)}`
  return item.amount === 1 ? '' : `${item.amount}`
}

export default function ShoppingListView({ initialFoods, initialItems }: ShoppingListViewProps) {
  const foods = useFoodStore((state) => state.foods)
  const setFoods = useFoodStore((state) => state.setFoods)
  const items = useShoppingListStore((state) => state.items)
  const setItems = useShoppingListStore((state) => state.setItems)
  const upsertItem = useShoppingListStore((state) => state.upsertItem)

  const [variant, setVariant] = useState<AddVariant>('food')

  const [selectedFood, setSelectedFood] = useState<Food | null>(null)
  const [foodName, setFoodName] = useState('')

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [productName, setProductName] = useState('')

  const [freeformName, setFreeformName] = useState('')
  const [freeformUnit, setFreeformUnit] = useState('')

  const [amount, setAmount] = useState(1)
  const [unit, setUnit] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [selectedItems, setSelectedItems] = useState<ShoppingListItem[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setItems(initialItems)
  }, [initialItems, setItems])

  // Populate the food catalog that backs FoodSearch's instant local suggestions. Prefer a
  // server-provided list; otherwise fetch it in the background. Either way FoodSearch queries the
  // server per keystroke, so this only speeds up pre-debounce matches and must never block the page.
  useEffect(() => {
    if (initialFoods) {
      setFoods(initialFoods)
      return
    }
    let cancelled = false
    apiFetchFoods()
      .then((fetched) => { if (!cancelled && fetched.length > 0) setFoods(fetched) })
      .catch(() => { /* instant suggestions are best-effort; server search still works */ })
    return () => { cancelled = true }
  }, [initialFoods, setFoods])

  // Food and Product both constrain the Advanced unit picker to their own Measurements.
  const selectedSource = variant === 'product' ? selectedProduct : selectedFood
  const unitOptions = useMemo(
    () => shoppingUnitOptions(getSourceUnits(selectedSource)).map((sourceUnit) => ({ label: sourceUnit, value: sourceUnit })),
    [selectedSource]
  )

  function resetForm() {
    setSelectedFood(null)
    setFoodName('')
    setSelectedProduct(null)
    setProductName('')
    setFreeformName('')
    setFreeformUnit('')
    setAmount(1)
    setUnit('')
  }

  function handleVariantChange(next: AddVariant) {
    if (next === variant) return
    setVariant(next)
    setSaveError(null)
    // Collapse the unit override so each variant starts from its own clean default.
    setShowAdvanced(false)
    resetForm()
  }

  function handleFoodSelected(food: Food) {
    setSelectedFood(food)
    setFoodName(food.name)
    // The unit is auto-derived and hidden; the user only sees it via "Advanced".
    setUnit(preferredShoppingUnit(getSourceUnits(food)))
  }

  function handleFoodInputChange(text: string) {
    setFoodName(text)
    // Editing or clearing the search text invalidates a previously selected food,
    // so the item can no longer be added until a food is re-selected.
    if (selectedFood && text !== selectedFood.name) {
      setSelectedFood(null)
      setUnit('')
    }
  }

  function handleProductSelected(product: Product) {
    setSelectedProduct(product)
    setProductName(product.name)
    setUnit(preferredShoppingUnit(getSourceUnits(product)))
  }

  async function handleAddItem() {
    if (amount <= 0) return

    setSaving(true)
    setSaveError(null)
    try {
      let created: ShoppingListItem
      if (variant === 'food') {
        if (!selectedFood || !unit) return
        created = await apiCreateShoppingListItem({ sourceType: 'food', foodId: selectedFood.id, amount, unit })
      } else if (variant === 'product') {
        if (!selectedProduct || !unit) return
        created = await apiCreateShoppingListItem({ sourceType: 'product', productId: selectedProduct.id, amount, unit })
      } else {
        const name = freeformName.trim()
        if (!name) return
        created = await apiCreateShoppingListItem({ sourceType: 'freeform', name, amount, unit: freeformUnit.trim() || undefined })
      }
      upsertItem(created)
      resetForm()
    } catch {
      setSaveError('Failed to add item. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const isAddDisabled = saving || amount <= 0 ||
    (variant === 'food' && (!selectedFood || !unit)) ||
    (variant === 'product' && (!selectedProduct || !unit)) ||
    (variant === 'freeform' && freeformName.trim().length === 0)

  // Food/Product lines have an auto-derived unit revealed via "Advanced"; freeform takes a free-text unit inline.
  const showAdvancedToggle = variant !== 'freeform'

  function renderItemRow(item: ShoppingListItem) {
    const selected = selectedItems.some((entry) => entry.id === item.id)
    const quantity = itemQuantityLabel(item)
    return (
      <div className={`shopping-list-item${selected ? ' is-selected' : ''}`}>
        <Checkbox checked={selected} readOnly tabIndex={-1} className="item-check" />
        <div className="item-body">
          <span className="item-name">{item.name}</span>
          {quantity && <span className="item-qty">{quantity}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="shopping-list">
      <div className="shopping-list-content">
        <header className="shopping-list-header">
          <h1>Shopping List</h1>
        </header>

        <div className="shopping-list-panel">
          <div className="variant-tabs" role="tablist" aria-label="Item type">
            {(Object.keys(VARIANT_LABELS) as AddVariant[]).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={variant === option}
                className={`variant-tab${variant === option ? ' is-active' : ''}`}
                onClick={() => handleVariantChange(option)}
              >
                {VARIANT_LABELS[option]}
              </button>
            ))}
          </div>

          <div className="add-item-form">
            {variant === 'food' && (
              <div className="field field-food">
                {/* FoodSearch renders its own aria-labelled input and exposes no matching control id,
                    so this stays a bare caption rather than an htmlFor label pointing at nothing. */}
                <label>Food</label>
                <FoodSearch
                  value={foodName}
                  localFoods={foods}
                  onChange={handleFoodSelected}
                  onInputChange={handleFoodInputChange}
                  placeholder="Search foods"
                  inputAriaLabel="Shopping list food"
                />
              </div>
            )}

            {variant === 'product' && (
              <div className="field field-product">
                <label>Product</label>
                <ProductSearch
                  value={productName}
                  onChange={handleProductSelected}
                  placeholder="Search products"
                  inputAriaLabel="Shopping list product"
                />
              </div>
            )}

            {variant === 'freeform' && (
              <div className="field field-freeform">
                <label htmlFor="shopping-list-freeform-name">Item</label>
                <InputText
                  id="shopping-list-freeform-name"
                  value={freeformName}
                  onChange={(e) => setFreeformName(e.target.value)}
                  placeholder="e.g. Trash bags"
                  aria-label="Shopping list item name"
                />
              </div>
            )}

            <div className="field field-amount">
              <label htmlFor="shopping-list-amount">Amount</label>
              <InputNumber
                inputId="shopping-list-amount"
                min={0.01}
                minFractionDigits={0}
                maxFractionDigits={2}
                value={amount}
                onValueChange={(e: InputNumberValueChangeEvent) => setAmount(e.value ?? 1)}
              />
            </div>

            {variant === 'freeform' && (
              <div className="field field-unit">
                <label htmlFor="shopping-list-freeform-unit">Unit</label>
                <InputText
                  id="shopping-list-freeform-unit"
                  value={freeformUnit}
                  onChange={(e) => setFreeformUnit(e.target.value)}
                  placeholder="Optional"
                  aria-label="Shopping list freeform unit"
                />
              </div>
            )}

            {showAdvancedToggle && showAdvanced && (
              <div className="field field-unit">
                <label htmlFor="shopping-list-unit">Unit</label>
                <Dropdown
                  inputId="shopping-list-unit"
                  ariaLabel="Shopping list unit"
                  value={unit}
                  onChange={(e) => setUnit(e.value)}
                  options={unitOptions}
                  placeholder="Select"
                />
              </div>
            )}

            <button
              type="button"
              className="add-item-button"
              onClick={handleAddItem}
              disabled={isAddDisabled}
            >
              {saving ? 'Adding…' : 'Add Item'}
            </button>
          </div>

          {showAdvancedToggle && (
            <button
              type="button"
              className="advanced-toggle"
              aria-expanded={showAdvanced}
              onClick={() => setShowAdvanced((shown) => !shown)}
            >
              {showAdvanced ? 'Hide advanced' : 'Advanced'}
            </button>
          )}

          {saveError && (
            <div className="add-item-error" role="alert">
              {saveError}
            </div>
          )}

          {items.length === 0 ? (
            <p className="shopping-list-empty">No items yet. Add a food to start your shopping list.</p>
          ) : (
            <ListBox
              multiple
              metaKeySelection={false}
              dataKey="id"
              value={selectedItems}
              onChange={(e) => setSelectedItems(e.value)}
              options={items}
              optionLabel="name"
              itemTemplate={renderItemRow}
              className="shopping-list-items"
              pt={{ list: { 'aria-label': 'Shopping list items' } }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
