import Link from 'next/link'
import { formatPrice } from '@/utils/currency'
import { formatUnitForAmount } from '@/utils/unitConversion'
import { formatUtcDateForInput } from '@/utils/dateHelpers'
import type { ArchivedShoppingList, ShoppingListItem } from '@/types/ShoppingList'

// A single archived list's bought lines and the prices paid, read-only. Amount only reads when it
// carries meaning (a unit, or a non-bare count) — mirroring the active list's row rendering.
function itemQuantityLabel(item: ShoppingListItem): string {
  if (item.unit) return `${item.amount} ${formatUnitForAmount(item.amount, item.unit)}`
  return item.amount === 1 ? '' : `${item.amount}`
}

function formatListDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ArchivedShoppingListDetail({ list }: { list: ArchivedShoppingList }) {
  return (
    <div className="shopping-list">
      <div className="shopping-list-content">
        <header className="shopping-list-header">
          <h1>{formatListDate(list.dateAdded)}</h1>
          <div className="shopping-list-header-actions">
            <Link href="/shopping-list/archived" className="share-button">
              <i className="pi pi-arrow-left" aria-hidden="true" />
              All trips
            </Link>
          </div>
        </header>

        <div className="shopping-list-panel">
          {list.items.length === 0 ? (
            <p className="shopping-list-empty">Nothing was bought on this trip.</p>
          ) : (
            <ul className="archived-items" aria-label="Bought items">
              {list.items.map((item) => {
                const quantity = itemQuantityLabel(item)
                return (
                  <li key={item.id} className="archived-item">
                    <span className="archived-item-name">{item.name}</span>
                    {item.expirationDate && (
                      <span className="item-expiration">Exp {formatUtcDateForInput(item.expirationDate)}</span>
                    )}
                    {quantity && <span className="item-qty">{quantity}</span>}
                    <span className="archived-item-price">
                      {item.linePrice != null ? formatPrice(item.linePrice) : '—'}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="shopping-list-footer">
            <strong>Total spent: </strong>
            <p className="shopping-list-count">
              {list.totalSpent > 0 ? formatPrice(list.totalSpent) : 'No prices recorded'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
