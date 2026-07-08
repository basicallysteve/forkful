import moment from 'moment'

// Helper function to get today's date in YYYY-MM-DD format for date inputs
export function getTodayDateString(): string {
  return moment().format('YYYY-MM-DD')
}

// Helper function to format a date to YYYY-MM-DD format for date inputs
export function formatDateForInput(date: Date): string {
  return moment(date).format('YYYY-MM-DD')
}

// Date-only values (an expiration day, no time-of-day) are stored as UTC-midnight timestamps. Format
// and parse them in UTC — not local time like formatDateForInput — so the calendar day never shifts
// for users outside UTC (a 2026-08-01T00:00:00Z timestamp must read back as "2026-08-01" everywhere).
export function formatUtcDateForInput(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function parseInputDateAsUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}
