import type { PantryItemStatus } from '@/types/PantryItem'

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24
const EXPIRING_SOON_THRESHOLD_DAYS = 7

export function calculatePantryStatus(expirationDate: Date | null): PantryItemStatus {
  if (!expirationDate) return 'good'
  const now = new Date()
  const daysUntilExpiration = Math.ceil((expirationDate.getTime() - now.getTime()) / MILLISECONDS_PER_DAY)
  if (daysUntilExpiration < 0) return 'expired'
  if (daysUntilExpiration <= EXPIRING_SOON_THRESHOLD_DAYS) return 'expiring-soon'
  return 'good'
}
