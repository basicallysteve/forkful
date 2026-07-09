'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { useSwipeable } from 'react-swipeable'
import FoodSearch from '@/components/FoodSearch/FoodSearch'
import ProductSearch from '@/components/ProductSearch/ProductSearch'
import { useFoodStore } from '@/stores/food'
import { useShoppingListStore } from '@/stores/shoppingList'
import {
  apiCompleteShoppingTrip,
  apiCreateShoppingListItem,
  apiDeleteShoppingListItem,
  apiSplitShoppingListItem,
  apiUpdateShoppingListItemDetails,
  apiUpdateShoppingListItemStatus,
} from '@/lib/api/shoppingList'
import type { ShoppingListItemPortionInput } from '@/lib/api/shoppingList'
import { apiFetchFoods } from '@/lib/api/foods'
import { apiUpdateShoppingPreferences } from '@/lib/api/users'
import { formatUnitForAmount, preferredShoppingUnit, shoppingUnitOptions } from '@/utils/unitConversion'
import { calendarValueToUtcDate, formatUtcDateForInput, utcDateToCalendarValue } from '@/utils/dateHelpers'
import { ceil2, round2 } from '@/utils/number'
import { formatPrice } from '@/utils/currency'
import type { Food } from '@/types/Food'
import type { Product } from '@/types/Product'
import type { ShoppingListItem, ShoppingListItemSourceType, ShoppingListItemStatus } from '@/types/ShoppingList'
import { InputNumber } from 'primereact/inputnumber'
import type { InputNumberValueChangeEvent } from 'primereact/inputnumber'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { ListBox } from 'primereact/listbox'
import { Checkbox } from 'primereact/checkbox'
import { Calendar } from 'primereact/calendar'
// PrimeReact's Calendar emits a FormEvent; there is no dedicated CalendarChangeEvent export in v10.
import type { FormEvent as CalendarChangeEvent } from 'primereact/ts-helpers'
import Modal from '@/components/Modal/Modal'
import { Menu } from 'primereact/menu'
import type { MenuItem } from 'primereact/menuitem'

type ShoppingListViewProps = {
  // Optional: the server no longer ships the whole catalog. When omitted, the view loads it lazily.
  initialFoods?: Food[]
  initialItems: ShoppingListItem[]
  // Optional so existing tests can omit them. userId scopes the preference PATCH;
  // pricingCollectionEnabled is the user's "collect Line Price & expiration" preference — when false,
  // the check-off prompt and the manual ⋯ entry are both suppressed. Defaults to on.
  userId?: number
  pricingCollectionEnabled?: boolean
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

// The Line Price can be entered as the whole-line total or as a per-unit price. `total` is the mode
// carried straight through; `per_unit` is multiplied by the line's quantity. Either way only the total
// is persisted, so this collapses both modes to a single rounded total (2 decimals, matching the
// numeric(10,2) column). An empty (null) value clears the price.
export type LinePriceMode = 'total' | 'per_unit'

export function resolveLinePriceTotal(mode: LinePriceMode, value: number | null, quantity: number): number | null {
  if (value === null || !Number.isFinite(value)) return null
  // The line total rounds UP so a per-unit × quantity total never undercharges a partial cent. A
  // directly-entered total is already at the cent (the input caps at 2 decimals), so ceiling is a no-op.
  return ceil2(mode === 'per_unit' ? value * quantity : value)
}

// Expiration is either one date for the whole line, or a date per item — which splits the line into
// separate lines grouped by date (see CONTEXT.md). Per-item is only offered when the line has more than
// one of something.
export type ExpirationMode = 'whole' | 'per_item'

// A row in the per-item editor: a share of the amount plus its Calendar-local date (null = undated).
export type ItemExpirationPortion = { amount: number; date: Date | null }

// Collapse per-item portions into one entry per distinct expiration day (undated is its own group),
// summing amounts and dropping non-positive shares. Dates are normalised to the UTC date-only value we
// persist, so two picks of the same calendar day always merge regardless of the local time-of-day.
export function groupExpirationPortions(portions: ItemExpirationPortion[]): ShoppingListItemPortionInput[] {
  const groups = new Map<string, ShoppingListItemPortionInput>()
  for (const portion of portions) {
    if (!(portion.amount > 0)) continue
    const utcDate = portion.date ? calendarValueToUtcDate(portion.date) : null
    const key = utcDate ? utcDate.toISOString() : 'none'
    const existing = groups.get(key)
    if (existing) existing.amount = round2(existing.amount + portion.amount)
    else groups.set(key, { amount: round2(portion.amount), expirationDate: utcDate })
  }
  return [...groups.values()]
}

// What the details dialog hands back: a plain price/expiration edit, or — when per-item dates resolve to
// more than one group — a split into date-grouped lines.
export type ItemDetailsSubmit =
  | { kind: 'details'; linePrice: number | null; expirationDate: Date | null }
  | { kind: 'split'; linePrice: number | null; portions: ShoppingListItemPortionInput[] }

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
  pricingCollectionEnabled,
  onRemove,
  onSetStatus,
  onEditDetails,
}: {
  item: ShoppingListItem
  selected: boolean
  pricingCollectionEnabled: boolean
  onRemove: (id: number) => Promise<void>
  onSetStatus: (item: ShoppingListItem, status: ShoppingListItemStatus) => Promise<void>
  onEditDetails: (item: ShoppingListItem) => void
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
    // Manual price/expiration entry is hidden entirely when the user has collection turned off.
    ...(pricingCollectionEnabled
      ? [{ label: 'Price & expiration', icon: 'pi pi-dollar', command: () => onEditDetails(item) }]
      : []),
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
          {item.expirationDate && (
            <span className="item-expiration">Exp {formatUtcDateForInput(item.expirationDate)}</span>
          )}
          {item.linePrice != null && <span className="item-price">{formatPrice(item.linePrice)}</span>}
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

let portionKeySeq = 0

type EditablePortion = { key: number; amount: number | null; date: Date | null }

function makePortion(amount: number | null, date: Date | null): EditablePortion {
  return { key: portionKeySeq++, amount, date }
}

// The optional check-off details editor's body: Line Price (total or per-unit) and expiration. Both are
// optional — clearing the price persists null, a blank date a null expiration. Expiration is either one
// date for the whole line, or a date per item, which splits the line into date-grouped lines. Mounted
// with `key={item.id}` by the dialog so its useState seeds fresh from each line without an effect.
function ItemDetailsForm({
  item,
  saving,
  error,
  collectionEnabled,
  onToggleCollection,
  onHide,
  onSave,
}: {
  item: ShoppingListItem
  saving: boolean
  error: string | null
  collectionEnabled: boolean
  onToggleCollection: (enabled: boolean) => void
  onHide: () => void
  onSave: (submit: ItemDetailsSubmit) => void
}) {
  const [mode, setMode] = useState<LinePriceMode>('total')
  const [priceValue, setPriceValue] = useState<number | null>(item.linePrice)

  const seededDate = item.expirationDate ? utcDateToCalendarValue(item.expirationDate) : null
  const [expirationMode, setExpirationMode] = useState<ExpirationMode>('whole')
  const [wholeDate, setWholeDate] = useState<Date | null>(seededDate)
  const [portions, setPortions] = useState<EditablePortion[]>(() => [makePortion(item.amount, seededDate)])

  const quantity = item.amount
  // Per-item dates only make sense when buying more than one of something.
  const canSplit = quantity > 1
  // The Calendar's floor: today at local midnight, so past days can't be picked.
  const minDate = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  // Flipping the price mode converts the value so the resulting total is preserved: a unit price rounds
  // to the nearest cent, a total rounds up — matching resolveLinePriceTotal.
  function handleModeChange(next: LinePriceMode) {
    if (next === mode) return
    setPriceValue((value) => {
      if (value === null) return value
      return next === 'per_unit' ? round2(value / quantity) : ceil2(value * quantity)
    })
    setMode(next)
  }

  function updatePortion(key: number, patch: Partial<EditablePortion>) {
    setPortions((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function addPortion() {
    // Seed a new row with whatever quantity is still unassigned, so a simple two-way split is one click.
    const remaining = round2(quantity - portions.reduce((sum, row) => sum + (row.amount ?? 0), 0))
    setPortions((rows) => [...rows, makePortion(remaining > 0 ? remaining : null, null)])
  }

  function removePortion(key: number) {
    setPortions((rows) => (rows.length > 1 ? rows.filter((row) => row.key !== key) : rows))
  }

  const assigned = round2(portions.reduce((sum, row) => sum + (row.amount ?? 0), 0))
  const portionsCoverLine = Math.abs(assigned - quantity) <= 0.005
  const linePrice = resolveLinePriceTotal(mode, priceValue, quantity)
  const resolvedTotal = linePrice

  // Per-item entry is only invalid while the portions don't add up to the line; the whole-line path is
  // always valid (price and date are both optional).
  const canSave = expirationMode === 'whole' || !canSplit || portionsCoverLine

  function handleSave() {
    if (expirationMode === 'per_item' && canSplit) {
      const groups = groupExpirationPortions(portions.map((row) => ({ amount: row.amount ?? 0, date: row.date })))
      // One resolved group is just a plain edit (all items share a date, or none) — no split needed.
      if (groups.length > 1) {
        onSave({ kind: 'split', linePrice, portions: groups })
        return
      }
      onSave({ kind: 'details', linePrice, expirationDate: groups[0]?.expirationDate ?? null })
      return
    }
    onSave({
      kind: 'details',
      linePrice,
      // A picked day is anchored at UTC midnight so the stored day is timezone-stable.
      expirationDate: wholeDate ? calendarValueToUtcDate(wholeDate) : null,
    })
  }

  const footer = (
    <div className="dialog-footer">
      <button type="button" className="ghost-button" onClick={onHide} disabled={saving}>
        Cancel
      </button>
      <button type="button" className="primary-button" onClick={handleSave} disabled={saving || !canSave}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )

  return (
    <Modal
      header="Price & expiration"
      visible
      onHide={onHide}
      footer={footer}
      className="item-details-dialog"
      style={{ width: 'min(440px, 92vw)' }}
    >
      <div className="item-details-form">
        <div className="field">
          <span className="field-label" id="line-price-mode-label">Line Price</span>
          <div className="price-mode" role="group" aria-labelledby="line-price-mode-label">
            {(['total', 'per_unit'] as LinePriceMode[]).map((option) => (
              <button
                key={option}
                type="button"
                className={`price-mode-tab${mode === option ? ' is-active' : ''}`}
                aria-pressed={mode === option}
                onClick={() => handleModeChange(option)}
              >
                {option === 'total' ? 'Total' : 'Per unit'}
              </button>
            ))}
          </div>
          <InputNumber
            inputId="line-price"
            value={priceValue}
            onValueChange={(e: InputNumberValueChangeEvent) => setPriceValue(e.value ?? null)}
            mode="decimal"
            min={0}
            minFractionDigits={2}
            maxFractionDigits={2}
            prefix="$"
            placeholder="0.00"
            aria-label={mode === 'per_unit' ? 'Per-unit price' : 'Line price total'}
          />
          {mode === 'per_unit' && resolvedTotal !== null && (
            <small className="price-hint">Total: {formatPrice(resolvedTotal)}</small>
          )}
        </div>

        <div className="field">
          <span className="field-label" id="expiration-mode-label">Expiration date</span>
          {canSplit && (
            <div className="expiration-mode" role="group" aria-labelledby="expiration-mode-label">
              {(['whole', 'per_item'] as ExpirationMode[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`price-mode-tab${expirationMode === option ? ' is-active' : ''}`}
                  aria-pressed={expirationMode === option}
                  onClick={() => setExpirationMode(option)}
                >
                  {option === 'whole' ? 'Whole line' : 'Per item'}
                </button>
              ))}
            </div>
          )}

          {expirationMode === 'whole' || !canSplit ? (
            <Calendar
              inputId="line-expiration"
              value={wholeDate}
              onChange={(e: CalendarChangeEvent<Date>) => setWholeDate(e.value ?? null)}
              minDate={minDate}
              dateFormat="yy-mm-dd"
              placeholder="Select a date"
              showButtonBar
              ariaLabel="Expiration date"
            />
          ) : (
            <div className="expiration-portions">
              {portions.map((portion, index) => (
                <div className="expiration-portion" key={portion.key}>
                  <InputNumber
                    inputId={`portion-amount-${index}`}
                    value={portion.amount}
                    onValueChange={(e: InputNumberValueChangeEvent) => updatePortion(portion.key, { amount: e.value ?? null })}
                    min={0}
                    minFractionDigits={0}
                    maxFractionDigits={2}
                    placeholder="Qty"
                    aria-label={`Item ${index + 1} quantity`}
                  />
                  <Calendar
                    inputId={`portion-date-${index}`}
                    value={portion.date}
                    onChange={(e: CalendarChangeEvent<Date>) => updatePortion(portion.key, { date: e.value ?? null })}
                    minDate={minDate}
                    dateFormat="yy-mm-dd"
                    placeholder="Select a date"
                    showButtonBar
                    ariaLabel={`Item ${index + 1} expiration date`}
                  />
                  {portions.length > 1 && (
                    <button
                      type="button"
                      className="portion-remove"
                      aria-label={`Remove date ${index + 1}`}
                      onClick={() => removePortion(portion.key)}
                    >
                      <i className="pi pi-times" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
              <div className="expiration-portions-footer">
                <button type="button" className="portion-add" onClick={addPortion}>
                  <i className="pi pi-plus" aria-hidden="true" /> Add date
                </button>
                <small className={portionsCoverLine ? 'portion-tally' : 'portion-tally is-off'}>
                  {assigned} of {quantity} {item.unit ? formatUnitForAmount(quantity, item.unit) : 'items'}
                </small>
              </div>
            </div>
          )}
          <small>Optional — carries to the pantry when you finish shopping.</small>
        </div>

        {/* Toggles the profile preference straight away (checked = don't collect), independent of
            Save/Cancel, which only act on this line. */}
        <label className="collection-skip">
          <Checkbox
            inputId="skip-collection"
            checked={!collectionEnabled}
            onChange={(e) => onToggleCollection(!e.checked)}
          />
          <span>Don&apos;t ask on future shopping lists</span>
        </label>

        {error && <p className="item-details-error" role="alert">{error}</p>}
      </div>
    </Modal>
  )
}

// Available while the list is active, so it doubles as the "edit later" path as well as the
// at-check-off capture. Keyed on the line id and mounted only while a line is being edited, so the
// form's inputs seed fresh from that line on open (no reset effect needed).
function ItemDetailsDialog({
  item,
  saving,
  error,
  collectionEnabled,
  onToggleCollection,
  onHide,
  onSave,
}: {
  item: ShoppingListItem | null
  saving: boolean
  error: string | null
  collectionEnabled: boolean
  onToggleCollection: (enabled: boolean) => void
  onHide: () => void
  onSave: (submit: ItemDetailsSubmit) => void
}) {
  if (!item) return null
  return (
    <ItemDetailsForm
      key={item.id}
      item={item}
      saving={saving}
      error={error}
      collectionEnabled={collectionEnabled}
      onToggleCollection={onToggleCollection}
      onHide={onHide}
      onSave={onSave}
    />
  )
}

// The single batch prompt shown at Shopping Trip Completion when lines remain unbought (`to_buy` and
// `unavailable` together — the two are not distinguished here). Keep moves them onto a fresh active
// list; Drop discards them with the archive. Only mounted while `count > 0`; when nothing is left the
// trip completes without a prompt.
function CompleteTripDialog({
  count,
  saving,
  error,
  onKeep,
  onDrop,
  onCancel,
}: {
  count: number
  saving: boolean
  error: string | null
  onKeep: () => void
  onDrop: () => void
  onCancel: () => void
}) {
  const footer = (
    <div className="dialog-footer">
      <button type="button" className="ghost-button" onClick={onCancel} disabled={saving}>
        Cancel
      </button>
      <button type="button" className="ghost-button" onClick={onDrop} disabled={saving}>
        Drop them
      </button>
      {/* Keep is the default (see CONTEXT.md). */}
      <button type="button" className="primary-button" onClick={onKeep} disabled={saving} autoFocus>
        {saving ? 'Finishing…' : 'Keep for next time'}
      </button>
    </div>
  )

  return (
    <Modal
      header="Finish shopping"
      visible
      onHide={onCancel}
      footer={footer}
      className="complete-trip-dialog"
      style={{ width: 'min(420px, 92vw)' }}
    >
      <p className="complete-trip-message">
        You still have {count} item{count !== 1 ? 's' : ''} on your list — keep {count !== 1 ? 'them' : 'it'} for next time?
      </p>
      <p className="complete-trip-note">
        Bought items move to your pantry either way.
      </p>
      {error && <p className="item-details-error" role="alert">{error}</p>}
    </Modal>
  )
}

export default function ShoppingListView({
  initialFoods,
  initialItems,
  userId,
  pricingCollectionEnabled = true,
}: ShoppingListViewProps) {
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

  // The line whose Price & expiration dialog is open (null = closed), plus its own save/error state so
  // a details save never touches the add-item form's banner.
  const [detailsItem, setDetailsItem] = useState<ShoppingListItem | null>(null)
  const [detailsSaving, setDetailsSaving] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)

  // The user's "collect price & expiration" preference, held locally so the modal checkbox and the
  // inline "enable" link feel instant. Persisted optimistically; rolled back if the PATCH fails.
  const [collectionEnabled, setCollectionEnabled] = useState(pricingCollectionEnabled)

  // Shopping Trip Completion state: the leftover batch prompt's visibility, the in-flight flag while the
  // completion request runs, its own error banner, and the post-trip confirmation shown once it lands.
  const [showCompletePrompt, setShowCompletePrompt] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [tripSummary, setTripSummary] = useState<string | null>(null)

  async function updateCollectionEnabled(next: boolean) {
    if (next === collectionEnabled) return
    const previous = collectionEnabled
    setCollectionEnabled(next)
    setSaveError(null)
    try {
      if (userId != null) await apiUpdateShoppingPreferences(userId, { enableShoppingListPricingCollection: next })
    } catch {
      setCollectionEnabled(previous)
      setSaveError('Failed to update your preference. Please try again.')
    }
  }

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
  // feels instant, then persist. Only `status` changes server-side and the source reference is never
  // touched, so the optimistic clone stays correct on success — no reconcile needed. On failure roll
  // the line back to its prior status and surface the shared error banner.
  async function handleSetStatus(item: ShoppingListItem, status: ShoppingListItemStatus) {
    if (item.status === status) return
    const previous = item.status
    const next = status
    setSaveError(null)
    upsertItem({ ...item, status: next })
    try {
      await apiUpdateShoppingListItemStatus(item.id, next)
      // Checking a line off is the moment to record what it cost and when it expires, so surface the
      // details dialog automatically — but only once the check-off has actually persisted, so a failed
      // toggle never pops a dialog. Only the to-bought transition prompts; unchecking or marking a line
      // unavailable never does — and only when the user hasn't turned price/expiration collection off.
      if (next === 'bought' && collectionEnabled) handleEditDetails({ ...item, status: next })
    } catch {
      const current = useShoppingListStore.getState().items.find((entry) => entry.id === item.id)
      // Only roll back if nothing else has changed the line since this request started.
      if (current?.status === next) upsertItem({ ...item, status: previous })
      setSaveError('Failed to update item. Please try again.')
    }
  }

  function handleEditDetails(item: ShoppingListItem) {
    setDetailsError(null)
    setDetailsItem(item)
  }

  function handleCloseDetails() {
    if (detailsSaving) return
    setDetailsItem(null)
    setDetailsError(null)
  }

  // Persist the dialog's edit, then replace the store copy(ies) with the re-joined line(s) the server
  // returns (carrying the persisted, rounded price). A plain edit updates one line; a per-item split
  // replaces the one line with the several date-grouped lines it becomes. Unlike the status flip this
  // isn't optimistic: the dialog stays open with a spinner until the write confirms. On failure the
  // dialog keeps its inputs and shows an inline error.
  async function handleSaveDetails(submit: ItemDetailsSubmit) {
    if (!detailsItem) return
    setDetailsSaving(true)
    setDetailsError(null)
    try {
      if (submit.kind === 'split') {
        const updated = await apiSplitShoppingListItem(detailsItem.id, {
          portions: submit.portions,
          linePrice: submit.linePrice,
        })
        updated.forEach(upsertItem)
      } else {
        const updated = await apiUpdateShoppingListItemDetails(detailsItem.id, {
          linePrice: submit.linePrice,
          expirationDate: submit.expirationDate,
        })
        upsertItem(updated)
      }
      setDetailsItem(null)
    } catch {
      setDetailsError('Failed to save. Please try again.')
    } finally {
      setDetailsSaving(false)
    }
  }

  // Lines still unbought at completion: `to_buy` and `unavailable` together, since the batch prompt
  // does not distinguish them. Drives whether finishing needs the keep/drop prompt at all.
  const unboughtItems = useMemo(
    () => items.filter((item) => item.status === 'to_buy' || item.status === 'unavailable'),
    [items],
  )

  // Archive the active list and transfer bought lines to the pantry. `keepUnbought` answers the leftover
  // prompt; the direct (no-leftover) path passes false. On success swap the store to the server's new
  // active list (the kept lines, or empty) and show a confirmation. `fromPrompt` routes the error banner
  // to the open dialog vs. the main add-item banner.
  async function completeTrip(keepUnbought: boolean, fromPrompt: boolean) {
    setCompleting(true)
    setCompleteError(null)
    setSaveError(null)
    try {
      const result = await apiCompleteShoppingTrip(keepUnbought)
      setItems(result.items)
      setShowCompletePrompt(false)
      const created = result.pantryItemsCreated
      setTripSummary(`Shopping trip complete — ${created} item${created !== 1 ? 's' : ''} added to your pantry.`)
    } catch {
      if (fromPrompt) setCompleteError('Failed to finish shopping. Please try again.')
      else setSaveError('Failed to finish shopping. Please try again.')
    } finally {
      setCompleting(false)
    }
  }

  // "Done shopping": prompt for the leftovers when any remain, otherwise finish straight away.
  function handleDoneShopping() {
    setTripSummary(null)
    setSaveError(null)
    if (unboughtItems.length > 0) {
      setCompleteError(null)
      setShowCompletePrompt(true)
    } else {
      void completeTrip(false, false)
    }
  }

  function handleCancelComplete() {
    if (completing) return
    setShowCompletePrompt(false)
    setCompleteError(null)
  }

  // The Listbox's selection is a live view of which lines are `bought`, derived from status rather than
  // held as separate state — so an optimistic status flip (or its rollback) re-renders the selection.
  const boughtItems = useMemo(() => items.filter((item) => item.status === 'bought'), [items])
  const totalPrice = useMemo(() => ceil2(boughtItems.reduce((sum, item) => sum + (item.linePrice ?? 0), 0)), [boughtItems])
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
          <div className="shopping-list-header-actions">
            <button
              type="button"
              className="share-button"
              onClick={handleShare}
              disabled={items.length === 0}
            >
              <i className={`pi ${copied ? 'pi-check' : 'pi-share-alt'}`} aria-hidden="true" />
              {copied ? 'Copied!' : 'Share'}
            </button>
            <button
              type="button"
              className="done-shopping-button"
              onClick={handleDoneShopping}
              disabled={items.length === 0 || completing}
            >
              <i className="pi pi-check-circle" aria-hidden="true" />
              {completing && !showCompletePrompt ? 'Finishing…' : 'Done shopping'}
            </button>
          </div>
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

          {tripSummary && (
            <div className="trip-summary" role="status">
              {tripSummary}
            </div>
          )}

          {!collectionEnabled && (
            <p className="collection-off-hint">
              <em>
                Price &amp; expiration collection is off —{' '}
                <button type="button" className="collection-enable-link" onClick={() => updateCollectionEnabled(true)}>
                  click here to enable
                </button>
                .
              </em>
            </p>
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
                  pricingCollectionEnabled={collectionEnabled}
                  onRemove={handleRemove}
                  onSetStatus={handleSetStatus}
                  onEditDetails={handleEditDetails}
                />
              )}
              className="shopping-list-items"
              pt={{ list: { 'aria-label': 'Shopping list items' } }}
            />
          )}
          <div className="shopping-list-footer">
            <strong>Totals: </strong>
            <p className="shopping-list-count">{boughtItems.length} item{boughtItems.length !== 1 ? 's' : ''}</p>
            <p className="shopping-list-count">{totalPrice > 0 ? formatPrice(totalPrice) : 'No prices yet'}</p>
          </div>
        </div>
      </div>

      <ItemDetailsDialog
        item={detailsItem}
        saving={detailsSaving}
        error={detailsError}
        collectionEnabled={collectionEnabled}
        onToggleCollection={updateCollectionEnabled}
        onHide={handleCloseDetails}
        onSave={handleSaveDetails}
      />

      {showCompletePrompt && (
        <CompleteTripDialog
          count={unboughtItems.length}
          saving={completing}
          error={completeError}
          onKeep={() => completeTrip(true, true)}
          onDrop={() => completeTrip(false, true)}
          onCancel={handleCancelComplete}
        />
      )}
    </div>
  )
}
