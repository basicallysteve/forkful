/** The things that need the admin's attention. Add a kind here and in `adminSignalCopy`. */
export const ADMIN_EVENT_KINDS = [
  'review-report',
  'feedback',
  'account-deactivated',
  'account-deleted',
  'invite-accepted',
] as const

export type AdminEventKind = (typeof ADMIN_EVENT_KINDS)[number]

/** What an email needs to know about one event: what happened and when, never who or what was said. */
export interface AdminSignalEvent {
  kind: AdminEventKind
  createdAt: Date
}
