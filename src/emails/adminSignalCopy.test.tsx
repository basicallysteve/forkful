import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AdminSignalEmail } from '@/emails/AdminSignalEmail'
import { AdminSignalSummaryEmail } from '@/emails/AdminSignalSummaryEmail'
import { adminSignalCountLines, adminSignalSubject, adminSignalText } from '@/emails/adminSignalCopy'
import type { AdminEventKind, AdminSignalEvent } from '@/lib/adminEventKinds'

const adminUrl = 'https://app.example.com/admin/reports'
const at = new Date('2026-11-24T15:42:00Z')

function ev(kind: AdminEventKind, createdAt = at): AdminSignalEvent {
  return { kind, createdAt }
}
function plain(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ')
}

describe('adminSignalSubject', () => {
  it.each([
    ['review-report', 'EatForkful: New Review Report'],
    ['feedback', 'EatForkful: New Feedback'],
    ['account-deactivated', 'EatForkful: Account Deactivated'],
    ['account-deleted', 'EatForkful: Account Deleted'],
    ['invite-accepted', 'EatForkful: Invite Accepted'],
  ] as const)('a single %s event uses its own subject', (kind, subject) => {
    expect(adminSignalSubject([ev(kind)])).toBe(subject)
  })

  it('a summary counts every event in the subject', () => {
    expect(adminSignalSubject([ev('review-report'), ev('review-report'), ev('feedback')])).toBe(
      'EatForkful: 3 things need your attention',
    )
  })
})

describe('adminSignalCountLines', () => {
  it('gives one line per kind present, with correct singular and plural', () => {
    const lines = adminSignalCountLines([
      ev('review-report'), ev('review-report'), ev('review-report'),
      ev('feedback'), ev('account-deactivated'), ev('invite-accepted'),
    ])
    expect(lines).toEqual(['3 Review Reports', '1 New Feedback', '1 Account Deactivated', '1 Invite Accepted'])
  })

  it('pluralizes the other kinds and leaves out kinds with no events', () => {
    expect(adminSignalCountLines([ev('account-deleted'), ev('account-deleted'), ev('invite-accepted'), ev('invite-accepted')])).toEqual([
      '2 Accounts Deleted',
      '2 Invites Accepted',
    ])
  })
})

describe('AdminSignalEmail (immediate)', () => {
  it('says what happened, when, and links with a label rather than a raw URL', () => {
    const html = renderToStaticMarkup(<AdminSignalEmail event={ev('review-report')} adminUrl={adminUrl} />)
    expect(plain(html)).toContain('A user reported a review.')
    expect(plain(html)).toContain('Nov 24')
    expect(html).toContain(`<a href="${adminUrl}"`)
    expect(html).toContain('Open the admin page</a>')
    expect(plain(html)).not.toContain(adminUrl)
  })

  it('has a short plain sentence for every kind', () => {
    const sentences = (['feedback', 'account-deactivated', 'account-deleted', 'invite-accepted'] as const).map((kind) =>
      plain(renderToStaticMarkup(<AdminSignalEmail event={ev(kind)} adminUrl={adminUrl} />)),
    )
    expect(sentences[0]).toContain('A user sent feedback.')
    expect(sentences[1]).toContain('A user deactivated their account.')
    expect(sentences[2]).toContain('A user deleted their account.')
    expect(sentences[3]).toContain('An invite was accepted.')
  })
})

describe('AdminSignalSummaryEmail', () => {
  const events = [ev('review-report'), ev('review-report'), ev('review-report'), ev('feedback'), ev('invite-accepted')]
  const since = new Date('2026-11-24T15:30:00Z')
  const html = renderToStaticMarkup(<AdminSignalSummaryEmail events={events} since={since} adminUrl={adminUrl} />)

  it('starts with "Since {time}:" and lists a count per kind present', () => {
    const text = plain(html)
    expect(text).toMatch(/Since Nov 24, [^:]*:\d\d [^:]*:/)
    expect(text).toContain('3 Review Reports')
    expect(text).toContain('1 New Feedback')
    expect(text).toContain('1 Invite Accepted')
    expect(text).not.toContain('Account Deactivated')
    expect(text).not.toContain('Account Deleted')
  })

  it('links with the label "Open the admin page"', () => {
    expect(html).toContain(`<a href="${adminUrl}"`)
    expect(html).toContain('Open the admin page</a>')
    expect(plain(html)).not.toContain(adminUrl)
  })
})

describe('adminSignalText (plain-text version)', () => {
  it('carries the full URL for an immediate email', () => {
    const text = adminSignalText([ev('review-report')], null, adminUrl)
    expect(text).toContain('A user reported a review.')
    expect(text).toContain(adminUrl)
  })

  it('carries the since line, the counts and the full URL for a summary', () => {
    const text = adminSignalText([ev('review-report'), ev('review-report'), ev('feedback')], new Date('2026-11-24T15:30:00Z'), adminUrl)
    expect(text).toContain('Since ')
    expect(text).toContain('2 Review Reports')
    expect(text).toContain('1 New Feedback')
    expect(text).toContain(adminUrl)
  })
})
