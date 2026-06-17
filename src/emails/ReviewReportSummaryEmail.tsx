import { BaseEmail } from './BaseEmail'

interface ReportItem {
  reason: string
  reviewAuthor: string | null
  reviewRating: number
  reviewBody: string | null
  reportedAt: string
  reporterUsername: string | null
  reportComment: string | null
}

interface Props {
  reportCount: number
  reports: ReportItem[]
  adminUrl: string
}

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  offensive_language: 'Offensive language',
  harassment: 'Harassment',
  off_topic: 'Off-topic',
}

const BORDER_COLOR = '#e4e4e7'
const MUTED_TEXT = '#71717a'
const BODY_TEXT = '#3f3f46'
const DANGER_RED = '#ef4444'

export function ReviewReportSummaryEmail({ reportCount, reports, adminUrl }: Props) {
  return (
    <BaseEmail
      subject={`${reportCount} new review report${reportCount !== 1 ? 's' : ''} on Forkful`}
      previewText={`${reportCount} review${reportCount !== 1 ? 's were' : ' was'} reported in the last 24 hours.`}
      variant="functional"
    >
      <p style={{ margin: '0 0 8px', fontSize: 13, color: MUTED_TEXT, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Moderation Summary
      </p>
      <p style={{ margin: '0 0 20px', fontSize: 15, color: BODY_TEXT }}>
        <strong>{reportCount}</strong> review{reportCount !== 1 ? 's were' : ' was'} reported in the last 24 hours.
      </p>

      {reports.map((report, i) => (
        <table
          key={i}
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{
            marginBottom: 16,
            border: `1px solid ${BORDER_COLOR}`,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <tbody>
            <tr>
              <td style={{ padding: '10px 16px', backgroundColor: '#fef2f2', borderBottom: `1px solid ${BORDER_COLOR}` }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: DANGER_RED, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  {REASON_LABELS[report.reason] ?? report.reason}
                </span>
                <span style={{ fontSize: 12, color: MUTED_TEXT, marginLeft: 10 }}>
                  {report.reportedAt}
                  {report.reporterUsername ? ` · reported by ${report.reporterUsername}` : ''}
                </span>
              </td>
            </tr>
            <tr>
              <td style={{ padding: '12px 16px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: BODY_TEXT }}>
                  {'★'.repeat(report.reviewRating)}{'☆'.repeat(5 - report.reviewRating)}
                  {' '}by {report.reviewAuthor ?? 'Anonymous'}
                </p>
                {report.reviewBody && (
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED_TEXT, fontStyle: 'italic' }}>
                    "{report.reviewBody.slice(0, 200)}{report.reviewBody.length > 200 ? '…' : ''}"
                  </p>
                )}
                {report.reportComment && (
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: MUTED_TEXT }}>
                    Reporter note: {report.reportComment}
                  </p>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      ))}

      <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginTop: 24 }}>
        <tbody>
          <tr>
            <td>
              <a
                href={adminUrl}
                style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Review in admin →
              </a>
            </td>
          </tr>
        </tbody>
      </table>
    </BaseEmail>
  )
}
