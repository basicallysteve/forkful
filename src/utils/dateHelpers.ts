import moment from 'moment'

// Helper function to get today's date in YYYY-MM-DD format for date inputs
export function getTodayDateString(): string {
  return moment().format('YYYY-MM-DD')
}

// Helper function to format a date to YYYY-MM-DD format for date inputs
export function formatDateForInput(date: Date): string {
  return moment(date).format('YYYY-MM-DD')
}
