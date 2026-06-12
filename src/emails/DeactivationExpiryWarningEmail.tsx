import { BaseEmail } from './BaseEmail'

interface Props {
  username: string
  deletionDate: string
  reactivateUrl: string
  trackingPixelUrl?: string
}

export function DeactivationExpiryWarningEmail({ username, deletionDate, reactivateUrl, trackingPixelUrl }: Props) {
  return (
    <BaseEmail
      subject="Your Forkful account will be deleted soon"
      previewText={`Your deactivated Forkful account is scheduled for deletion on ${deletionDate}. Log in to keep it.`}
      variant="functional"
      trackingPixelUrl={trackingPixelUrl}
    >
      <p style={{ margin: '0 0 8px', fontSize: 13, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Account Notice
      </p>
      <h1 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 700, color: '#09090b' }}>
        Hi {username}, your account is expiring
      </h1>

      <p style={{ margin: '0 0 16px' }}>
        Your Forkful account has been deactivated for nearly a year. To keep your data safe,
        accounts that remain deactivated for 12 months are permanently deleted.
      </p>

      <p style={{ margin: '0 0 24px' }}>
        <strong>Your account is scheduled for deletion on {deletionDate}.</strong> If you&apos;d
        like to keep your recipes and pantry data, just log in before then — you&apos;ll be
        prompted to reactivate.
      </p>

      <table cellPadding={0} cellSpacing={0} style={{ marginBottom: 24 }}>
        <tbody>
          <tr>
            <td style={{ borderRadius: 8, backgroundColor: '#10b981' }}>
              <a
                href={reactivateUrl}
                style={{
                  display: 'inline-block',
                  padding: '12px 28px',
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#ffffff',
                  textDecoration: 'none',
                  borderRadius: 8,
                }}
              >
                Keep my account
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      <p style={{ margin: '0 0 4px', fontSize: 13, color: '#71717a' }}>
        If you no longer want your account, you don&apos;t need to do anything — it will be
        deleted automatically on {deletionDate}.
      </p>
    </BaseEmail>
  )
}
