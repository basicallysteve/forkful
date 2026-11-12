'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'

import { Card } from 'primereact/card'
import { Tag } from 'primereact/tag'
import { usePantryStore } from '@/stores/pantry'
import type { PantryItemStatus } from '@/types/PantryItem'
import type { PantryQueryOptions } from '@/lib/pantry'
import { toSlug } from '@/utils/slug'
import { itemDisplayName } from '@/utils/pantryItemName'
import { formatPrice } from '@/utils/currency'
import { formatDisplayDate } from '@/utils/dateHelpers'
import { apiFetchPantryItems, apiDeletePantryItem, apiDeletePantryItems, apiUpdatePantryItem } from '@/lib/api/pantry'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { Checkbox } from 'primereact/checkbox'
import PantryRowActions from './PantryRowActions'
import UndoToasts from './UndoToasts'
import StatusDot from '@/components/StatusLegend/StatusDot'
import StatusLegend from '@/components/StatusLegend/StatusLegend'

type SortOption = NonNullable<PantryQueryOptions['sortBy']>
type SortDirection = NonNullable<PantryQueryOptions['sortDir']>
type StatusFilter = NonNullable<PantryQueryOptions['status']>

const UNDO_WINDOW_MS = 6000
// After a delete, rows shift up under the cursor; ignore clicks this soon after so a double-click can't delete the next row.
const DELETE_GUARD_MS = 400

interface PendingDelete {
  key: number
  ids: number[]
  message: string
  /** True once the undo window has closed and the request is in flight; the rows stay hidden until it settles. */
  sending: boolean
}

function displayUnit(size: number, unit: string | undefined): string {
  if (!unit) return ''
  if (unit === 'serving') return size === 1 ? 'serving' : 'servings'
  return unit
}

export default function Pantry() {
  const allItems = usePantryStore((state) => state.items)
  const setItems = usePantryStore((state) => state.setItems)
  const deleteItem = usePantryStore((state) => state.deleteItem)
  const updateItem = usePantryStore((state) => state.updateItem)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [sortBy, setSortBy] = useState<SortOption>('expirationDate')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [pending, setPending] = useState<PendingDelete[]>([])
  const pendingTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  const nextKey = useRef(0)
  const deleteLocked = useRef(false)

  // Rows with a delete waiting out its undo window stay in the store but are hidden from the view,
  // so Undo puts them back in their original position.
  const items = useMemo(() => {
    const hidden = new Set(pending.flatMap((entry) => entry.ids))
    return hidden.size === 0 ? allItems : allItems.filter((item) => !hidden.has(item.id))
  }, [allItems, pending])

  useEffect(() => {
    const timers = pendingTimers.current
    // Leaving the page drops any unsent delete, so the item stays (the safe default).
    return () => timers.forEach(clearTimeout)
  }, [])

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Debounce search input; all other filter changes apply immediately
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    const delay = searchTerm ? 300 : 0
    searchDebounce.current = setTimeout(() => {
      setLoading(true)
      setFetchError(false)
      apiFetchPantryItems({ search: searchTerm || undefined, status: statusFilter, sortBy, sortDir: sortDirection })
        .then(setItems)
        .catch(() => setFetchError(true))
        .finally(() => setLoading(false))
    }, delay)
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current)
    }
  }, [searchTerm, statusFilter, sortBy, sortDirection, setItems])

  function handleSelectItem(itemId: number) {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) newSelected.delete(itemId)
    else newSelected.add(itemId)
    setSelectedItems(newSelected)
  }

  function handleSelectAll() {
    if (selectedItems.size === items.length) setSelectedItems(new Set())
    else setSelectedItems(new Set(items.map((item) => item.id)))
  }

  function scheduleDelete(ids: number[], message: string): boolean {
    if (deleteLocked.current) return false
    deleteLocked.current = true
    setTimeout(() => { deleteLocked.current = false }, DELETE_GUARD_MS)
    const key = nextKey.current++
    setActionError(null)
    setPending((current) => [...current, { key, ids, message, sending: false }])
    pendingTimers.current.set(key, setTimeout(() => sendDelete(key, ids), UNDO_WINDOW_MS))
    return true
  }

  function dropPending(key: number) {
    pendingTimers.current.delete(key)
    setPending((current) => current.filter((entry) => entry.key !== key))
  }

  async function sendDelete(key: number, ids: number[]) {
    pendingTimers.current.delete(key)
    setPending((current) => current.map((entry) => (entry.key === key ? { ...entry, sending: true } : entry)))
    try {
      if (ids.length === 1) {
        await apiDeletePantryItem(ids[0])
        deleteItem(ids[0])
      } else {
        const deletedIds = await apiDeletePantryItems(ids)
        deletedIds.forEach((id) => deleteItem(id))
        if (deletedIds.length < ids.length) {
          setActionError(`Failed to delete ${ids.length - deletedIds.length} item(s). Please try again.`)
        }
      }
    } catch {
      setActionError(ids.length === 1 ? 'Failed to delete item. Please try again.' : 'Failed to delete items. Please try again.')
    }
    dropPending(key)
  }

  function handleUndo(key: number) {
    const timer = pendingTimers.current.get(key)
    if (timer) clearTimeout(timer)
    dropPending(key)
  }

  function handleDeleteSelected() {
    if (selectedItems.size === 0) return
    const ids = items.filter((item) => selectedItems.has(item.id)).map((item) => item.id)
    if (ids.length === 0) return
    const message = ids.length === 1 ? `Deleted ${itemDisplayName(items.find((i) => i.id === ids[0])!)}` : `Deleted ${ids.length} items`
    if (scheduleDelete(ids, message)) setSelectedItems(new Set())
  }

  function handleDelete(id: number) {
    const item = items.find((i) => i.id === id)
    if (!item) return
    if (!scheduleDelete([id], `Deleted ${itemDisplayName(item)}`)) return
    setSelectedItems((current) => {
      if (!current.has(id)) return current
      const next = new Set(current)
      next.delete(id)
      return next
    })
  }

  async function handleFreeze(id: number) {
    try {
      setActionError(null)
      const updated = await apiUpdatePantryItem(id, { frozenDate: new Date().toISOString() })
      if (updated) updateItem(updated)
    } catch {
      setActionError('Failed to freeze item. Please try again.')
    }
  }

  async function handleUnfreeze(id: number) {
    try {
      setActionError(null)
      const updated = await apiUpdatePantryItem(id, { frozenDate: null })
      if (updated) updateItem(updated)
    } catch {
      setActionError('Failed to thaw item. Please try again.')
    }
  }

  function formatDate(date: Date | null): string {
    if (!date) return 'No expiration'
    return formatDisplayDate(new Date(date))
  }

  function getStatusLabel(status: PantryItemStatus): string {
    switch (status) {
      case 'expired': return 'Expired'
      case 'expiring-soon': return 'Expiring Soon'
      case 'good': return 'Good'
      default: return 'Unknown'
    }
  }

  function getStatusSeverity(status: PantryItemStatus): 'success' | 'warning' | 'danger' | undefined {
    switch (status) {
      case 'expired': return 'danger'
      case 'expiring-soon': return 'warning'
      case 'good': return 'success'
      default: return undefined
    }
  }

  function getStatusClass(status: PantryItemStatus): string {
    switch (status) {
      case 'expired': return 'status-expired'
      case 'expiring-soon': return 'status-expiring-soon'
      case 'good': return 'status-good'
      default: return ''
    }
  }

  const expiredCount = items.filter((item) => item.status === 'expired').length
  const expiringSoonCount = items.filter((item) => item.status === 'expiring-soon').length
  const goodCount = items.filter((item) => item.status === 'good').length

  return (
    <div className="pantry-list">
      <div className="pantry-content">
        <div className="pantry-header">
          <div>
            <p className="pantry-label">Pantry Management</p>
            <h1 className="pantry-name">Pantry</h1>
          </div>
          <div className="pantry-meta">
            <Link href="/pantry/new" className="pantry-add-link">
              <Tag value="Add Item" />
            </Link>
          </div>
        </div>

        <div className="pantry-stats">
          <div className="stat-card">
            <span className="stat-label">Total Items</span>
            <span className="stat-value">{items.length}</span>
          </div>
          <div className="stat-card stat-good">
            <span className="stat-label">Good</span>
            <span className="stat-value">{goodCount}</span>
          </div>
          <div className="stat-card stat-warning">
            <span className="stat-label">Expiring Soon</span>
            <span className="stat-value">{expiringSoonCount}</span>
          </div>
          <div className="stat-card stat-danger">
            <span className="stat-label">Expired</span>
            <span className="stat-value">{expiredCount}</span>
          </div>
        </div>

        <StatusLegend
          items={[
            { variant: 'good', label: 'Good' },
            { variant: 'expiring-soon', label: 'Expiring Soon' },
            { variant: 'expired', label: 'Expired' },
            { variant: 'frozen', label: 'Frozen' },
            { variant: 'prepared', label: 'Prepared' },
          ]}
        />

        <div className="pantry-panel">
          <div className="panel-toolbar">
            <div className="toolbar-filters">
              <div className="filter-group">
                <InputText
                  className="filter-input"
                  placeholder="Search pantry items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  aria-label="Search pantry items"
                />
              </div>

              <div className="filter-group">
                <span className="filter-label">Status:</span>
                <Dropdown
                  className="filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.value as StatusFilter)}
                  options={[
                    { label: 'All', value: 'all' },
                    { label: 'Good', value: 'good' },
                    { label: 'Expiring Soon', value: 'expiring-soon' },
                    { label: 'Expired', value: 'expired' },
                  ]}
                  ariaLabel="Filter by status"
                />
              </div>

              <div className="filter-group">
                <span className="filter-label">Sort by:</span>
                <Dropdown
                  className="filter-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.value as SortOption)}
                  options={[
                    { label: 'Expiration Date', value: 'expirationDate' },
                    { label: 'Name', value: 'name' },
                    { label: 'Date Added', value: 'addedDate' },
                    { label: 'Status', value: 'status' },
                  ]}
                  ariaLabel="Sort by"
                />
              </div>

              <button
                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                className="sort-direction-button"
                aria-label="Toggle sort direction"
              >
                {sortDirection === 'asc' ? '↑' : '↓'}
              </button>
            </div>

            {selectedItems.size > 0 && (
              <div className="toolbar-actions">
                <button onClick={handleDeleteSelected} className="danger-button">
                  Delete ({selectedItems.size})
                </button>
              </div>
            )}
          </div>

          {selectedItems.size > 0 && (
            <div className="bulk-actions-bar">
              <span>{selectedItems.size} item(s) selected</span>
            </div>
          )}

          {actionError && (
            <div className="panel-content">
              <p className="form-error">{actionError}</p>
            </div>
          )}

          {loading ? (
            <div className="panel-content">
              <div className="empty-state">
                <p>Loading pantry...</p>
              </div>
            </div>
          ) : fetchError ? (
            <div className="panel-content">
              <div className="empty-state">
                <p>Failed to load pantry items. Please refresh the page.</p>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="panel-content">
              <div className="empty-state">
                <p>No pantry items found.</p>
                <Link href="/pantry/new" className="primary-button">
                  Add your first item
                </Link>
              </div>
            </div>
          ) : (
            <div className="panel-content">
              {/* Desktop table view */}
              <table className="pantry-table">
                <thead>
                  <tr>
                    <th>
                      <Checkbox
                        checked={selectedItems.size === items.length && items.length > 0}
                        onChange={handleSelectAll}
                        aria-label="Select all items"
                      />
                    </th>
                    <th>Food Item</th>
                    <th>Size (Orig/Curr)</th>
                    <th>Price Paid</th>
                    <th>Expiration Date</th>
                    <th>Status</th>
                    <th>Added Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className={getStatusClass(item.status)}>
                      <td>
                        <Checkbox
                          checked={selectedItems.has(item.id)}
                          onChange={() => handleSelectItem(item.id)}
                          aria-label={`Select ${itemDisplayName(item)}`}
                        />
                      </td>
                      <td>
                        {item.sourceType === 'recipe' ? (
                          <span className="pantry-item-name">
                            {item.recipeShortId ? (
                              <Link href={`/recipes/${item.recipeShortId}/${toSlug(item.recipeNameSnapshot ?? '')}`}>
                                {itemDisplayName(item)}
                              </Link>
                            ) : (
                              itemDisplayName(item)
                            )}
                            <Tag className="tag-ghost pantry-prepared-tag" value="Prepared" />
                          </span>
                        ) : item.food ? (
                          <Link href={`/foods/${toSlug(item.food.name)}`}>
                            {item.food.name}
                          </Link>
                        ) : (
                          <Link href={`/pantry/${item.id}/edit`}>{item.product?.name}</Link>
                        )}
                      </td>
                      <td>{item.originalSize.size.toFixed(2)} {displayUnit(item.originalSize.size, item.originalSize.unit)} / {item.currentSize.size.toFixed(2)} {displayUnit(item.currentSize.size, item.currentSize.unit)}</td>
                      <td>{item.purchasePrice != null ? formatPrice(item.purchasePrice) : '—'}</td>
                      <td>
                        {item.frozenDate ? (
                          <Tag severity="info" value="Frozen" />
                        ) : (
                          formatDate(item.expirationDate)
                        )}
                      </td>
                      <td>
                        <Tag severity={getStatusSeverity(item.status)} value={getStatusLabel(item.status)} />
                      </td>
                      <td>{formatDate(item.addedDate)}</td>
                      <td>
                        <div className="item-actions">
                          {item.frozenDate ? (
                            <button onClick={() => handleUnfreeze(item.id)} className="btn-small btn-info" title="Unfreeze item">
                              Thaw
                            </button>
                          ) : (
                            <button onClick={() => handleFreeze(item.id)} className="btn-small btn-info" title="Freeze item">
                              Freeze
                            </button>
                          )}
                          <Link href={`/pantry/${item.id}/edit`} className="btn-small btn-secondary">
                            Edit
                          </Link>
                          <button onClick={() => handleDelete(item.id)} className="btn-small btn-danger">
                            Delete
                          </button>
                        </div>
                        <PantryRowActions
                          itemId={item.id}
                          itemName={itemDisplayName(item)}
                          frozen={Boolean(item.frozenDate)}
                          onFreeze={() => handleFreeze(item.id)}
                          onThaw={() => handleUnfreeze(item.id)}
                          onDelete={() => handleDelete(item.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile card view */}
              <div className="select-all-row">
                <label className="select-all-label">
                  <Checkbox
                    className="select-all-checkbox"
                    checked={selectedItems.size === items.length && items.length > 0}
                    onChange={handleSelectAll}
                  />
                  <span className="checkbox-text">Select all</span>
                </label>
              </div>
              <div className="pantry-cards">
                {items.map((item) => (
                  <Card
                    key={item.id}
                    className={`pantry-card ${selectedItems.has(item.id) ? 'is-selected' : ''} ${getStatusClass(item.status)}`}
                  >
                    <div className="card-checkbox">
                      <Checkbox
                        className="item-checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => handleSelectItem(item.id)}
                        aria-label={`Select ${itemDisplayName(item)}`}
                      />
                    </div>
                    <div className="card-content">
                      <div className="card-header">
                        {item.sourceType === 'recipe' ? (
                          item.recipeShortId ? (
                            <Link
                              href={`/recipes/${item.recipeShortId}/${toSlug(item.recipeNameSnapshot ?? '')}`}
                              className="card-title"
                            >
                              {itemDisplayName(item)}
                            </Link>
                          ) : (
                            <span className="card-title">{itemDisplayName(item)}</span>
                          )
                        ) : item.food ? (
                          <Link href={`/foods/${toSlug(item.food.name)}`} className="card-title">
                            {item.food.name}
                          </Link>
                        ) : (
                          <Link href={`/pantry/${item.id}/edit`} className="card-title">{item.product?.name}</Link>
                        )}
                        <div className="card-badges">
                          <StatusDot variant={item.status} label={getStatusLabel(item.status)} />
                          {item.frozenDate && <StatusDot variant="frozen" label="Frozen" />}
                          {item.sourceType === 'recipe' && <StatusDot variant="prepared" label="Prepared" />}
                        </div>
                      </div>

                      <div className="card-details">
                        <div className="detail-row">
                          <span className="detail-label">Size:</span>
                          <span className="detail-value">
                            {item.originalSize.size.toFixed(2)} {displayUnit(item.originalSize.size, item.originalSize.unit)} / {item.currentSize.size.toFixed(2)} {displayUnit(item.currentSize.size, item.currentSize.unit)}
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">
                            {item.frozenDate ? 'Frozen:' : 'Expires:'}
                          </span>
                          <span className="detail-value">
                            {item.frozenDate ? formatDate(item.frozenDate) : formatDate(item.expirationDate)}
                          </span>
                        </div>
                        {item.purchasePrice != null && (
                          <div className="detail-row">
                            <span className="detail-label">Price paid:</span>
                            <span className="detail-value">{formatPrice(item.purchasePrice)}</span>
                          </div>
                        )}
                        <div className="detail-row">
                          <span className="detail-label">Added:</span>
                          <span className="detail-value">{formatDate(item.addedDate)}</span>
                        </div>
                      </div>

                      <div className="card-actions">
                        <div className="card-actions-group">
                          {item.frozenDate ? (
                            <button
                              onClick={() => handleUnfreeze(item.id)}
                              className="btn-small btn-info"
                              aria-label={`Thaw ${itemDisplayName(item)}`}
                            >
                              Thaw
                            </button>
                          ) : (
                            <button
                              onClick={() => handleFreeze(item.id)}
                              className="btn-small btn-info"
                              aria-label={`Freeze ${itemDisplayName(item)}`}
                            >
                              Freeze
                            </button>
                          )}
                          <Link
                            href={`/pantry/${item.id}/edit`}
                            className="btn-small btn-secondary"
                            aria-label={`Edit ${itemDisplayName(item)}`}
                          >
                            Edit
                          </Link>
                        </div>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="btn-small btn-danger card-action-delete"
                          aria-label={`Delete ${itemDisplayName(item)}`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <UndoToasts
        toasts={pending.filter((entry) => !entry.sending).map(({ key, message }) => ({ key, message }))}
        onUndo={handleUndo}
      />
    </div>
  )
}
