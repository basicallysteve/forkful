'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

import { Card } from 'primereact/card'
import { usePantryStore } from '@/stores/pantry'
import type { PantryItemStatus } from '@/types/PantryItem'
import type { PantryQueryOptions } from '@/lib/pantry'
import { toSlug } from '@/utils/slug'
import { apiFetchPantryItems, apiDeletePantryItem, apiDeletePantryItems, apiUpdatePantryItem } from '@/lib/api/pantry'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { Checkbox } from 'primereact/checkbox'

type SortOption = NonNullable<PantryQueryOptions['sortBy']>
type SortDirection = NonNullable<PantryQueryOptions['sortDir']>
type StatusFilter = NonNullable<PantryQueryOptions['status']>

export default function Pantry() {
  const items = usePantryStore((state) => state.items)
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

  async function handleDeleteSelected() {
    if (selectedItems.size === 0) return
    setActionError(null)
    try {
      const ids = [...selectedItems]
      const deletedIds = await apiDeletePantryItems(ids)
      deletedIds.forEach(id => deleteItem(id))
      if (deletedIds.length < ids.length) {
        setActionError(`Failed to delete ${ids.length - deletedIds.length} item(s). Please try again.`)
      }
      setSelectedItems(new Set())
    } catch {
      setActionError('Failed to delete items. Please try again.')
    }
  }

  async function handleDelete(id: number) {
    try {
      setActionError(null)
      await apiDeletePantryItem(id)
      deleteItem(id)
    } catch {
      setActionError('Failed to delete item. Please try again.')
    }
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
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  function getStatusLabel(status: PantryItemStatus): string {
    switch (status) {
      case 'expired': return 'Expired'
      case 'expiring-soon': return 'Expiring Soon'
      case 'good': return 'Good'
      default: return 'Unknown'
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
            <Link href="/pantry/new" className="pill pill-primary">
              Add Item
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
                          aria-label={`Select ${item.food?.name ?? item.product?.name ?? ''}`}
                        />
                      </td>
                      <td>
                        {item.food ? (
                          <Link href={`/foods/${toSlug(item.food.name)}`}>
                            {item.food.name}
                          </Link>
                        ) : (
                          <span>{item.product?.name}</span>
                        )}
                      </td>
                      <td>{item.originalSize.size.toFixed(2)} {item.originalSize.unit} / {item.currentSize.size.toFixed(2)} {item.currentSize.unit}</td>
                      <td>
                        {item.frozenDate ? (
                          <span className="status-badge status-frozen">Frozen</span>
                        ) : (
                          formatDate(item.expirationDate)
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${getStatusClass(item.status)}`}>
                          {getStatusLabel(item.status)}
                        </span>
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
                        aria-label={`Select ${item.food?.name ?? item.product?.name ?? ''}`}
                      />
                    </div>
                    <div className="card-content">
                      <div className="card-header">
                        {item.food ? (
                          <Link href={`/foods/${toSlug(item.food.name)}`} className="card-title">
                            {item.food.name}
                          </Link>
                        ) : (
                          <span className="card-title">{item.product?.name}</span>
                        )}
                        <div className="card-badges">
                          <span className={`status-badge ${getStatusClass(item.status)}`}>
                            {getStatusLabel(item.status)}
                          </span>
                          {item.frozenDate && (
                            <span className="status-badge status-frozen">Frozen</span>
                          )}
                        </div>
                      </div>

                      <div className="card-details">
                        <div className="detail-row">
                          <span className="detail-label">Size:</span>
                          <span className="detail-value">
                            {item.originalSize.size.toFixed(2)} {item.originalSize.unit} / {item.currentSize.size.toFixed(2)} {item.currentSize.unit}
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
                        <div className="detail-row">
                          <span className="detail-label">Added:</span>
                          <span className="detail-value">{formatDate(item.addedDate)}</span>
                        </div>
                      </div>

                      <div className="card-actions">
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
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
