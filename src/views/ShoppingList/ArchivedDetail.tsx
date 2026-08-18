import Link from 'next/link'
import { formatPrice } from '@/utils/currency'
import { formatDisplayDate, formatUtcDateForInput } from '@/utils/dateHelpers'
import { itemQuantityLabel } from '@/utils/shoppingListDisplay'
import type { ArchivedShoppingList } from '@/types/ShoppingList'

// A single archived list's bought lines and the prices paid, read-only.
export default function ArchivedShoppingListDetail({ list }: { list: ArchivedShoppingList }) {
  // A recorded Line Price of $0.00 (free/comped) is valid, so "were any prices recorded" is the presence
  // of a non-null linePrice — not totalSpent > 0, which would hide a legitimate all-$0 trip.
  const hasAnyPrice = list.items.some((item) => item.linePrice != null)
  return (
    <div className="shopping-list">
      <div className="shopping-list-content">
        <header className="shopping-list-header">
          <h1>{formatDisplayDate(list.dateAdded)}</h1>
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
              {hasAnyPrice ? formatPrice(list.totalSpent) : 'No prices recorded'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
