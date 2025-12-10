// Helper function to get today's date in YYYY-MM-DD format for date inputs
export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]
}

// Helper function to format a date to YYYY-MM-DD format for date inputs
export function formatDateForInput(date: Date): string {
  return new Date(date).toISOString().split('T')[0]
}
