import { BaseEmail } from './BaseEmail'
import { ADMIN_SIGNAL_LINK_LABEL, adminSignalHeading, adminSignalSentence, adminSignalSubject, formatSignalTime } from './adminSignalCopy'
import type { AdminSignalEvent } from '@/lib/adminEventKinds'

interface Props {
  event: AdminSignalEvent
  adminUrl: string
}

export function AdminSignalEmail({ event, adminUrl }: Props) {
  return (
    <BaseEmail subject={adminSignalSubject([event])} previewText={adminSignalSentence(event.kind)} variant="functional">
      <h1 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 700, color: '#09090b' }}>
        {adminSignalHeading([event])}
      </h1>
      <p style={{ margin: '0 0 8px' }}>{adminSignalSentence(event.kind)}</p>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: '#71717a' }}>{formatSignalTime(event.createdAt)}</p>

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
