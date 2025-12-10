import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { usePantryStore } from '@/stores/pantry'
import type { PantryItemStatus } from '@/types/PantryItem'
import { toSlug } from '@/utils/slug'
import './pantry.scss'

type SortOption = 'name' | 'expirationDate' | 'addedDate' | 'status'
type SortDirection = 'asc' | 'desc'
type StatusFilter = 'all' | PantryItemStatus

// Status priority order for sorting
const STATUS_ORDER: Record<PantryItemStatus, number> = {
  'expired': 0,
  'expiring-soon': 1,
  'good': 2,
}

export default function Pantry() {
  const items = usePantryStore((state) => state.items)
  const deleteItem = usePantryStore((state) => state.deleteItem)
  const refreshItemStatuses = usePantryStore((state) => state.refreshItemStatuses)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [sortBy, setSortBy] = useState<SortOption>('expirationDate')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // Refresh statuses when component mounts or periodically
  useEffect(() => {
    refreshItemStatuses()
  }, [refreshItemStatuses])

  const filteredAndSortedItems = useMemo(() => {
    let filtered = items

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.food.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((item) => item.status === statusFilter)
    }

    // Sort items
    return filtered.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'name': {
          comparison = a.food.name.localeCompare(b.food.name)
          break
        }
        case 'expirationDate': {
          // Handle null expiration dates - put them at the end
          if (!a.expirationDate && !b.expirationDate) {
            comparison = 0
          } else if (!a.expirationDate) {
            comparison = 1
          } else if (!b.expirationDate) {
            comparison = -1
          } else {
            comparison = new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime()
          }
          break
        }
        case 'addedDate': {
          comparison = new Date(a.addedDate).getTime() - new Date(b.addedDate).getTime()
          break
        }
        case 'status': {
          comparison = STATUS_ORDER[a.status || 'good'] - STATUS_ORDER[b.status || 'good']
          break
        }
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [items, sortBy, sortDirection, searchTerm, statusFilter])

  function handleSelectItem(itemId: number) {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedItems(newSelected)
  }

  function handleSelectAll() {
    if (selectedItems.size === filteredAndSortedItems.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(filteredAndSortedItems.map((item) => item.id)))
    }
  }

  function handleDeleteSelected() {
    if (selectedItems.size === 0) return

    selectedItems.forEach((id) => {
      deleteItem(id)
    })
    setSelectedItems(new Set())
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
      case 'expired':
        return 'Expired'
      case 'expiring-soon':
        return 'Expiring Soon'
      case 'good':
        return 'Good'
      default:
        return 'Unknown'
    }
  }

  function getStatusClass(status: PantryItemStatus): string {
    switch (status) {
      case 'expired':
        return 'status-expired'
      case 'expiring-soon':
        return 'status-expiring-soon'
      case 'good':
        return 'status-good'
      default:
        return ''
    }
  }

  const expiredCount = items.filter((item) => item.status === 'expired').length
  const expiringSoonCount = items.filter((item) => item.status === 'expiring-soon').length
  const goodCount = items.filter((item) => item.status === 'good').length

  return (
    <div className="pantry-page">
      <div className="page-header">
        <h1>Pantry</h1>
        <Link to="/pantry/new" className="btn btn-primary">
          Add Item
        </Link>
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

      <div className="pantry-controls">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search pantry items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search pantry items"
          />
        </div>

        <div className="filter-controls">
          <label>
            Status:
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="Filter by status"
            >
              <option value="all">All</option>
              <option value="good">Good</option>
              <option value="expiring-soon">Expiring Soon</option>
              <option value="expired">Expired</option>
            </select>
          </label>

          <label>
            Sort by:
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="Sort by"
            >
              <option value="expirationDate">Expiration Date</option>
              <option value="name">Name</option>
              <option value="addedDate">Date Added</option>
              <option value="status">Status</option>
            </select>
          </label>

          <button
            onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            className="btn btn-secondary"
            aria-label="Toggle sort direction"
          >
            {sortDirection === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {selectedItems.size > 0 && (
        <div className="bulk-actions">
          <span>{selectedItems.size} item(s) selected</span>
          <button onClick={handleDeleteSelected} className="btn btn-danger">
            Delete Selected
          </button>
        </div>
      )}

      {filteredAndSortedItems.length === 0 ? (
        <div className="empty-state">
          <p>No pantry items found.</p>
          <Link to="/pantry/new" className="btn btn-primary">
            Add your first item
          </Link>
        </div>
      ) : (
        <div className="pantry-table-wrapper">
          <table className="pantry-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedItems.size === filteredAndSortedItems.length && filteredAndSortedItems.length > 0}
                    onChange={handleSelectAll}
                    aria-label="Select all items"
                  />
                </th>
                <th>Food Item</th>
                <th>Quantity</th>
                <th>Qty Left</th>
                <th>Size (Orig/Curr)</th>
                <th>Expiration Date</th>
                <th>Status</th>
                <th>Added Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedItems.map((item) => (
                <tr key={item.id} className={getStatusClass(item.status)}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={() => handleSelectItem(item.id)}
                      aria-label={`Select ${item.food.name}`}
                    />
                  </td>
                  <td>
                    <Link to={`/foods/${toSlug(item.food.name)}`}>
                      {item.food.name}
                    </Link>
                  </td>
                  <td>{item.quantity}</td>
                  <td>{item.quantityLeft}</td>
                  <td>{item.originalSize.toFixed(2)} / {item.currentSize.toFixed(2)}</td>
                  <td>{formatDate(item.expirationDate)}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(item.status)}`}>
                      {getStatusLabel(item.status)}
                    </span>
                  </td>
                  <td>{formatDate(item.addedDate)}</td>
                  <td>
                    <div className="item-actions">
                      <Link
                        to={`/pantry/${item.id}/edit`}
                        className="btn btn-small btn-secondary"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="btn btn-small btn-danger"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
