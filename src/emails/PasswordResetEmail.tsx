import { BaseEmail } from './BaseEmail'

interface Props {
  resetUrl: string
  /** Optional tracking-pixel URL. Generate server-side via sendPasswordResetEmail(). */
  trackingPixelUrl?: string
}

export function PasswordResetEmail({ resetUrl, trackingPixelUrl }: Props) {
  return (
    <BaseEmail
      subject="Reset your Forkful password"
      previewText="Click to reset your Forkful password. This link expires in 1 hour."
      variant="functional"
      trackingPixelUrl={trackingPixelUrl}
    >
      <p style={{ margin: '0 0 8px', fontSize: 13, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Account Security
      </p>
      <h1 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 700, color: '#09090b' }}>
        Reset your password
      </h1>

      <p style={{ margin: '0 0 24px' }}>
        We received a request to reset the password for your Forkful account.
        Click the button below to choose a new password.
        This link expires in <strong>1 hour</strong>.
      </p>

      {/* CTA button */}
      <table cellPadding={0} cellSpacing={0} style={{ marginBottom: 24 }}>
        <tbody>
          <tr>
            <td style={{ borderRadius: 8, backgroundColor: '#10b981' }}>
              <a
                href={resetUrl}
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
                Reset Password
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      <p style={{ margin: '0 0 4px', fontSize: 13, color: '#71717a' }}>
        Or copy and paste this link into your browser:
      </p>
      <p style={{ margin: 0, fontSize: 13, color: '#10b981', wordBreak: 'break-all' }}>
        {resetUrl}
      </p>
    </BaseEmail>
  )
}
