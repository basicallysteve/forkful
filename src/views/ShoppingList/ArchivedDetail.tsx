import Link from 'next/link'
import { Card } from 'primereact/card'
import { formatPrice } from '@/utils/currency'
import { formatDisplayDate, formatUtcDateForInput } from '@/utils/dateHelpers'
import { itemQuantityLabel } from '@/utils/shoppingListDisplay'
import type { ArchivedShoppingList } from '@/types/ShoppingList'

// A single archived list's bought lines and the prices paid, as a read-only card grid matching the
// Foods/Recipes browse pages. These cards don't navigate anywhere, so they're static (no hover accent).
export default function ArchivedShoppingListDetail({ list }: { list: ArchivedShoppingList }) {
  // A recorded Line Price of $0.00 (free/comped) is valid, so "were any prices recorded" is the presence
  // of a non-null linePrice — not totalSpent > 0, which would hide a legitimate all-$0 trip.
  const hasAnyPrice = list.items.some((item) => item.linePrice != null)
  return (
    <div className="archive-list">
      <div className="archive-content">
        <header className="archive-header">
          <div>
            <p className="archive-label">Shopping History</p>
            <h2 className="archive-name">{formatDisplayDate(list.dateAdded)}</h2>
          </div>
          <div className="archive-meta">
            <span className="pill pill-primary">
              {hasAnyPrice ? formatPrice(list.totalSpent) : 'No prices'}
            </span>
            <span className="pill pill-ghost">{list.items.length} item{list.items.length !== 1 ? 's' : ''}</span>
            <Link href="/shopping-list/archived" className="pill">All trips</Link>
          </div>
        </header>

        <section className="archive-panel">
          <div className="panel-content">
            {list.items.length === 0 ? (
              <p className="archive-empty-text">Nothing was bought on this trip.</p>
            ) : (
              <div className="archive-cards">
                {list.items.map((item) => {
                  const quantity = itemQuantityLabel(item)
                  return (
                    <Card key={item.id} className="archive-card is-static">
                      <div className="card-content">
                        <div className="card-header">
                          <h3 className="card-title">{item.name}</h3>
                          <div className="card-badges">
                            <span className="pill pill-ghost">
                              {item.linePrice != null ? formatPrice(item.linePrice) : '—'}
                            </span>
                          </div>
                        </div>
                        <div className="card-footer">
                          {quantity && <span className="card-meta">{quantity}</span>}
                          {item.expirationDate && (
                            <span className="card-meta">Exp {formatUtcDateForInput(item.expirationDate)}</span>
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
