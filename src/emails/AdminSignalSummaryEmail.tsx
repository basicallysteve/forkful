import { BaseEmail } from './BaseEmail'
import { ADMIN_SIGNAL_LINK_LABEL, adminSignalCountLines, adminSignalHeading, adminSignalSubject, formatSignalTime } from './adminSignalCopy'
import type { AdminSignalEvent } from '@/lib/adminEventKinds'

interface Props {
  events: AdminSignalEvent[]
  /** When the last admin email went out. */
  since: Date
  adminUrl: string
}

export function AdminSignalSummaryEmail({ events, since, adminUrl }: Props) {
  return (
    <BaseEmail subject={adminSignalSubject(events)} previewText={`${events.length} things need your attention.`} variant="functional">
      <h1 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 700, color: '#09090b' }}>
        {adminSignalHeading(events)}
      </h1>
      <p style={{ margin: '0 0 8px' }}>Since {formatSignalTime(since)}:</p>
      <ul style={{ margin: '0 0 24px', paddingLeft: 20 }}>
        {adminSignalCountLines(events).map((line) => (
          <li key={line} style={{ margin: '0 0 4px' }}>{line}</li>
        ))}
      </ul>

      <table cellPadding={0} cellSpacing={0}>
        <tbody>
          <tr>
            <td style={{ borderRadius: 8, backgroundColor: '#10b981' }}>
              <a
                href={adminUrl}
                style={{ display: 'inline-block', padding: '12px 28px', fontSize: 15, fontWeight: 600, color: '#ffffff', textDecoration: 'none', borderRadius: 8 }}
              >
                {ADMIN_SIGNAL_LINK_LABEL}
              </a>
            </td>
          </tr>
        </tbody>
      </table>
    </BaseEmail>
  )
}
