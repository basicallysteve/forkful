import Link from 'next/link'
import { formatPrice } from '@/utils/currency'
import type { ArchivedShoppingListSummary } from '@/types/ShoppingList'

// Read-only price-history index: every completed (archived) Shopping List, most recent first, each
// summarised by how many lines were bought and the total spent. Rendered server-side — there's no
// mutation here, so it needs no store or client state.
function formatListDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ArchivedShoppingLists({ lists }: { lists: ArchivedShoppingListSummary[] }) {
  return (
    <div className="shopping-list">
      <div className="shopping-list-content">
        <header className="shopping-list-header">
          <h1>Shopping History</h1>
          <div className="shopping-list-header-actions">
            <Link href="/shopping-list" className="share-button">
              <i className="pi pi-arrow-left" aria-hidden="true" />
              Back to list
            </Link>
          </div>
        </header>

        <div className="shopping-list-panel">
          {lists.length === 0 ? (
            <p className="shopping-list-empty">No completed trips yet. Finish a shopping trip to see it here.</p>
          ) : (
            <ul className="archived-lists" aria-label="Completed shopping trips">
              {lists.map((list) => (
                <li key={list.id} className="archived-list-row">
                  <Link href={`/shopping-list/archived/${list.id}`} className="archived-list-link">
                    <span className="archived-list-date">{formatListDate(list.dateAdded)}</span>
                    <span className="archived-list-count">
                      {list.boughtItemCount} item{list.boughtItemCount !== 1 ? 's' : ''}
                    </span>
                    <span className="archived-list-total">
                      {list.pricedItemCount > 0 ? formatPrice(list.totalSpent) : 'No prices'}
                    </span>
                    <i className="pi pi-chevron-right" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
