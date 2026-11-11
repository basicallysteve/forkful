// The app is single-currency and stores no currency code, so amounts are formatted for display only
// with a fixed locale + currency via Intl.NumberFormat (handles the symbol, grouping, and 2 decimals).
const priceFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function formatPrice(total: number): string {
  return priceFormatter.format(total)
}
