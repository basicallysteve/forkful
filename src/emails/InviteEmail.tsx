import { BaseEmail } from './BaseEmail'

interface Props {
  /** Create-account link carrying the invited email and the single-use code. */
  inviteUrl: string
}

export function InviteEmail({ inviteUrl }: Props) {
  return (
    <BaseEmail
      subject="You're invited to EatForkful"
      previewText="Your EatForkful invite is ready."
      variant="functional"
    >
      <h1 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 700, color: '#09090b' }}>
        You&apos;re invited to EatForkful
      </h1>

      <p style={{ margin: '0 0 24px' }}>
        Use the button below to create your account. The link never expires.
      </p>

      <table cellPadding={0} cellSpacing={0} style={{ marginBottom: 24 }}>
        <tbody>
          <tr>
            <td style={{ borderRadius: 8, backgroundColor: '#10b981' }}>
              <a
                href={inviteUrl}
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
                Create your account
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#71717a' }}>
        Prefer Google? Sign in with Google using this email address and you need no code.
      </p>
      <p style={{ margin: '0 0 4px', fontSize: 13, color: '#71717a' }}>
        Or copy and paste this link into your browser:
      </p>
      <p style={{ margin: 0, fontSize: 13, color: '#10b981', wordBreak: 'break-all' }}>
        {inviteUrl}
      </p>
    </BaseEmail>
  )
}
