import { ADMIN_EVENT_KINDS, type AdminEventKind, type AdminSignalEvent } from '@/lib/adminEventKinds'

/**
 * Wording for the admin signal emails (approved by Steve). Aggregate only: what happened and when,
 * never a username, an email address or any text a user wrote.
 */
const COPY: Record<AdminEventKind, { subject: string; sentence: string; singular: string; plural: string }> = {
  'review-report': { subject: 'New Review Report', sentence: 'A user reported a review.', singular: 'Review Report', plural: 'Review Reports' },
  feedback: { subject: 'New Feedback', sentence: 'A user sent feedback.', singular: 'Feedback Report', plural: 'Feedback Reports' },
  'account-deactivated': { subject: 'Account Deactivated', sentence: 'A user deactivated their account.', singular: 'Account Deactivated', plural: 'Accounts Deactivated' },
  'account-deleted': { subject: 'Account Deleted', sentence: 'A user deleted their account.', singular: 'Account Deleted', plural: 'Accounts Deleted' },
  'invite-accepted': { subject: 'Invite Accepted', sentence: 'An invite was accepted.', singular: 'Invite Accepted', plural: 'Invites Accepted' },
}

/** Where the "Open the admin page" link goes. Every kind lands on the reports page until the admin dashboard (#414) exists. */
export const ADMIN_SIGNAL_PATH = '/admin/reports'

export const ADMIN_SIGNAL_LINK_LABEL = 'Open the admin page'

export function adminSignalSentence(kind: AdminEventKind): string {
  return COPY[kind].sentence
}

/** "Nov 24, 3:42 PM UTC". Always formatted in UTC (not the server's zone), so say so rather than guess the admin's zone. */
export function formatSignalTime(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  })
}

export function adminSignalSubject(events: AdminSignalEvent[]): string {
  if (events.length === 1) return `EatForkful: ${COPY[events[0].kind].subject}`
  return `EatForkful: ${events.length} things need your attention`
}

/** The email's heading: the subject without the "EatForkful: " prefix. */
export function adminSignalHeading(events: AdminSignalEvent[]): string {
  return adminSignalSubject(events).replace(/^EatForkful: /, '')
}

/** When the oldest of these events happened: where a summary's "Since" starts. */
export function earliestEventTime(events: AdminSignalEvent[]): Date {
  return new Date(Math.min(...events.map((e) => e.createdAt.getTime())))
}

/** One line per kind present, e.g. "3 Review Reports", in a fixed kind order. */
export function adminSignalCountLines(events: AdminSignalEvent[]): string[] {
  return ADMIN_EVENT_KINDS.flatMap((kind) => {
    const count = events.filter((e) => e.kind === kind).length
    return count === 0 ? [] : [`${count} ${count === 1 ? COPY[kind].singular : COPY[kind].plural}`]
  })
}

/** The plain-text alternative: a text email can't carry a link label, so it shows the full URL. */
export function adminSignalText(events: AdminSignalEvent[], adminUrl: string): string {
  if (events.length === 1) {
    return [COPY[events[0].kind].sentence, formatSignalTime(events[0].createdAt), '', `${ADMIN_SIGNAL_LINK_LABEL}: ${adminUrl}`].join('\n')
  }
  return [`Since ${formatSignalTime(earliestEventTime(events))}:`, ...adminSignalCountLines(events).map((line) => `- ${line}`), '', `${ADMIN_SIGNAL_LINK_LABEL}: ${adminUrl}`].join('\n')
}
