import Link from 'next/link'
import { Card } from 'primereact/card'
import { formatPrice } from '@/utils/currency'
import { formatDisplayDate } from '@/utils/dateHelpers'
import type { ArchivedShoppingListSummary } from '@/types/ShoppingList'

// Read-only price-history index: every completed (archived) Shopping List, most recent first, as a card
// grid mirroring the Foods/Recipes browse pages. Each card taps through to that trip's detail. Rendered
// server-side — no mutation, so no store or client state; PrimeReact's Card renders fine from a Server
// Component since it's passed only serializable children (no handlers).
export default function ArchivedShoppingLists({ lists }: { lists: ArchivedShoppingListSummary[] }) {
  return (
    <div className="archive-list">
      <div className="archive-content">
        <header className="archive-header">
          <div>
            <p className="archive-label">Shopping</p>
            <h2 className="archive-name">Shopping History</h2>
          </div>
          <div className="archive-meta">
            <span className="pill pill-primary">{lists.length} trip{lists.length !== 1 ? 's' : ''}</span>
            <Link href="/shopping-list" className="pill">Back to list</Link>
          </div>
        </header>

        <section className="archive-panel">
          <div className="panel-content">
            {lists.length === 0 ? (
              <p className="archive-empty-text">No completed trips yet. Finish a shopping trip to see it here.</p>
            ) : (
              <div className="archive-cards">
                {lists.map((list) => (
                  <Card key={list.id} className="archive-card">
                    <Link href={`/shopping-list/archived/${list.id}`} className="card-content">
                      <div className="card-header">
                        <h3 className="card-title">{formatDisplayDate(list.dateAdded)}</h3>
                        <div className="card-badges">
                          <span className="pill pill-ghost">
                            {list.boughtItemCount} item{list.boughtItemCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="card-footer">
                        <span className="card-total">
                          {list.pricedItemCount > 0 ? formatPrice(list.totalSpent) : 'No prices'}
                        </span>
                        <i className="pi pi-chevron-right card-chevron" aria-hidden="true" />
                      </div>
                    </Link>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
