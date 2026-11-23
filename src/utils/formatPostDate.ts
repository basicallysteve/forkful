const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Format a `YYYY-MM-DD` calendar date for display ("June 10, 2026") without any
 * time-zone shift. Built from the parts, so the result is the same in every zone.
 * Returns '' for an empty or malformed value.
 */
export function formatPostDate(date: string): string {
  const match = DATE_RE.exec(date)
  if (!match) return ''
  const month = MONTHS[Number(match[2]) - 1]
  if (!month) return ''
  return `${month} ${Number(match[3])}, ${match[1]}`
}
