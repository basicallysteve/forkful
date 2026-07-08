'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { useSwipeable } from 'react-swipeable'
import FoodSearch from '@/components/FoodSearch/FoodSearch'
import ProductSearch from '@/components/ProductSearch/ProductSearch'
import { useFoodStore } from '@/stores/food'
import { useShoppingListStore } from '@/stores/shoppingList'
import { apiCreateShoppingListItem, apiDeleteShoppingListItem, apiUpdateShoppingListItemStatus } from '@/lib/api/shoppingList'
import { apiFetchFoods } from '@/lib/api/foods'
import { formatUnitForAmount, preferredShoppingUnit, shoppingUnitOptions } from '@/utils/unitConversion'
import type { Food } from '@/types/Food'
import type { Product } from '@/types/Product'
import type { ShoppingListItem, ShoppingListItemSourceType, ShoppingListItemStatus } from '@/types/ShoppingList'
import { InputNumber } from 'primereact/inputnumber'
import type { InputNumberValueChangeEvent } from 'primereact/inputnumber'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { ListBox } from 'primereact/listbox'
import { Checkbox } from 'primereact/checkbox'
import { Menu } from 'primereact/menu'
import type { MenuItem } from 'primereact/menuitem'

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

// Plain-text rendering of the list for the clipboard. Wrapped in a friendly, marketable message so a
// pasted list also invites the recipient to try EatForkful. One line per item as "- Name — qty" (the
// quantity is dropped when it carries no meaning, e.g. a bare 1). Exported so the exact format is
// unit-testable independently of the clipboard.
const SHARE_INTRO = "Hey! I'm sending you my shopping list from EatForkful — you should check it out!"
const SHARE_OUTRO = 'Build your own shopping list at eatforkful.com'

export function buildShoppingListText(items: ShoppingListItem[]): string {
  const lines = items.map((item) => {
    const quantity = itemQuantityLabel(item)
    return quantity ? `- ${item.name} — ${quantity}` : `- ${item.name}`
  })
  return [SHARE_INTRO, '', ...lines, '', SHARE_OUTRO].join('\n')
}

// A single list row inside the Listbox. The Listbox owns selection, and a selected row *is* a line
// marked `bought` — so the checkbox reflects that selection as a visual indicator (clicks are handled
// by the row). The kebab menu holds the row's secondary actions — the `unavailable`/`to_buy` status
// flip and Remove — stopping propagation so opening it never toggles the row's selection. Remove also
// has a swipe-reveal button, but only on mobile: at ≥721px that button is hidden and the kebab is the
// only way to delete; below 720px a left swipe reveals it. Extracted to a real component because
// useSwipeable is a hook and cannot live inside the Listbox itemTemplate callback.
function ShoppingListItemRow({
  item,
  selected,
  onRemove,
  onSetStatus,
}: {
  item: ShoppingListItem
  selected: boolean
  onRemove: (id: number) => Promise<void>
  onSetStatus: (item: ShoppingListItem, status: ShoppingListItemStatus) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [removing, setRemoving] = useState(false)
  const menu = useRef<Menu>(null)

  async function remove() {
    if (removing) return
    setRemoving(true)
    try {
      await onRemove(item.id)
    } finally {
      setRemoving(false)
    }
  }

  const swipe = useSwipeable({
    // First left swipe opens the row to reveal Remove; a second left swipe on an already-open row
    // commits the delete outright, so a decisive double-swipe removes without reaching for the button.
    onSwipedLeft: () => {
      if (open) remove()
      else setOpen(true)
    },
    onSwipedRight: () => setOpen(false),
    // Only react to a deliberate drag, and only to touch — on desktop the hover reveal handles it.
    delta: 40,
    trackMouse: false,
  })

  function handleRemoveClick(event: MouseEvent) {
    // The row lives inside a selectable Listbox item; stop the click from also toggling selection.
    event.stopPropagation()
    remove()
  }

  const unavailable = item.status === 'unavailable'

  // The status action flips `unavailable` (or back to `to_buy`); Remove follows after a separator and
  // is the desktop delete path (the swipe button is hidden there). On mobile both coexist.
  const menuItems: MenuItem[] = [
    unavailable
      ? { label: 'Mark to buy', icon: 'pi pi-shopping-cart', command: () => onSetStatus(item, 'to_buy') }
      : { label: 'Mark unavailable', icon: 'pi pi-ban', command: () => onSetStatus(item, 'unavailable') },
    { separator: true },
    { label: 'Remove', icon: 'pi pi-trash', className: 'menu-item-danger', command: () => remove() },
  ]

  const quantity = itemQuantityLabel(item)
  return (
    <div className={`shopping-list-row${open ? ' is-open' : ''}`} {...swipe}>
      <div className={`shopping-list-item status-${item.status}`}>
        <Checkbox checked={selected} readOnly tabIndex={-1} className="item-check" />
        <div className="item-body">
          <span className="item-name">{item.name}</span>
          {unavailable && <span className="item-status-pill">Unavailable</span>}
          {quantity && <span className="item-qty">{quantity}</span>}
        </div>
        <Menu model={menuItems} popup ref={menu} id={`shopping-list-menu-${item.id}`} />
        <button
          type="button"
          className="item-menu"
          aria-label={`More actions for ${item.name}`}
          aria-haspopup
          aria-controls={`shopping-list-menu-${item.id}`}
          onClick={(event) => {
            event.stopPropagation()
            menu.current?.toggle(event)
          }}
          // mousedown also bubbles to the Listbox item; keep it from starting a selection.
          onMouseDown={(event) => event.stopPropagation()}
        >
          <i className="pi pi-ellipsis-v" aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        className="item-remove"
        aria-label={`Remove ${item.name}`}
        onClick={handleRemoveClick}
        // mousedown also bubbles to the Listbox item; keep it from starting a selection.
        onMouseDown={(event) => event.stopPropagation()}
        disabled={removing}
      >
        <i className="pi pi-trash" aria-hidden="true" />
      </button>
    </div>
  )
}

export default function ShoppingListView({ initialFoods, initialItems }: ShoppingListViewProps) {
  const foods = useFoodStore((state) => state.foods)
  const setFoods = useFoodStore((state) => state.setFoods)
  const items = useShoppingListStore((state) => state.items)
  const setItems = useShoppingListStore((state) => state.setItems)
  const upsertItem = useShoppingListStore((state) => state.upsertItem)
  const removeItem = useShoppingListStore((state) => state.removeItem)

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
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // Holds the pending "Copied!" reset so a rapid re-copy restarts the 2s window instead of stacking
  // timers, and so it can be cancelled on unmount.
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setItems(initialItems)
  }, [initialItems, setItems])

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
  }, [])

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

  // Copy the whole list to the clipboard as plain text, with a brief "Copied!" confirmation. Reuses
  // the shared error banner if the browser blocks clipboard access (e.g. an insecure context).
  async function handleShare() {
    try {
      await navigator.clipboard.writeText(buildShoppingListText(items))
      setSaveError(null)
      setCopied(true)
      // Restart the window on each copy so the confirmation always lingers 2s past the latest one.
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      setSaveError('Failed to copy the list. Please try again.')
    }
  }

  // Remove Item (see CONTEXT.md): await the hard delete, then drop the line from the store. Mirrors
  // Pantry's handleDelete — the row only disappears once the server confirms.
  async function handleRemove(id: number) {
    setSaveError(null)
    try {
      await apiDeleteShoppingListItem(id)
      removeItem(id)
    } catch {
      setSaveError('Failed to remove item. Please try again.')
    }
  }

  // Manual check-off (see CONTEXT.md): flip the status in the store immediately so the aisle-side tap
  // feels instant, then persist. On failure roll the line back to its prior status and surface the
  // shared error banner. Reconcile with the server's returned line on success (the source reference is
  // never touched by a status change, so an optimistic clone stays valid).
  async function handleSetStatus(item: ShoppingListItem, status: ShoppingListItemStatus) {
    if (item.status === status) return
    const previous = item.status
    const next = status
    setSaveError(null)
    upsertItem({ ...item, status: next })
    try {
      const updated = await apiUpdateShoppingListItemStatus(item.id, next)
      const current = useShoppingListStore.getState().items.find((entry) => entry.id === item.id)
      // Only reconcile if the line is still in the optimistic state for this request.
      if (current?.status === next) upsertItem(updated)
    } catch {
      const current = useShoppingListStore.getState().items.find((entry) => entry.id === item.id)
      // Only roll back if nothing else has changed the line since this request started.
      if (current?.status === next) upsertItem({ ...item, status: previous })
      setSaveError('Failed to update item. Please try again.')
    }
  }

  // The Listbox's selection is a live view of which lines are `bought`, derived from status rather than
  // held as separate state — so an optimistic status flip (or its rollback) re-renders the selection.
  const boughtItems = useMemo(() => items.filter((item) => item.status === 'bought'), [items])

  // A row toggling in or out of the Listbox selection is a manual check-off: map the change to the
  // matching status transition. A plain click toggles one row, so at most one line differs here.
  // `unavailable` is never reached this way — only via a row's kebab menu.
  function handleSelectionChange(selected: ShoppingListItem[]) {
    const nextBought = new Set(selected.map((entry) => entry.id))
    for (const item of items) {
      const nowBought = nextBought.has(item.id)
      if (nowBought !== (item.status === 'bought')) {
        handleSetStatus(item, nowBought ? 'bought' : 'to_buy')
      }
    }
  }

  return (
    <div className="shopping-list">
      <div className="shopping-list-content">
        <header className="shopping-list-header">
          <h1>Shopping List</h1>
          <button
            type="button"
            className="share-button"
            onClick={handleShare}
            disabled={items.length === 0}
          >
            <i className={`pi ${copied ? 'pi-check' : 'pi-share-alt'}`} aria-hidden="true" />
            {copied ? 'Copied!' : 'Share'}
          </button>
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
              value={boughtItems}
              onChange={(e) => handleSelectionChange(e.value)}
              options={items}
              optionLabel="name"
              itemTemplate={(item: ShoppingListItem) => (
                <ShoppingListItemRow
                  item={item}
                  selected={item.status === 'bought'}
                  onRemove={handleRemove}
                  onSetStatus={handleSetStatus}
                />
              )}
              className="shopping-list-items"
              pt={{ list: { 'aria-label': 'Shopping list items' } }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
