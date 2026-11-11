import { BaseEmail } from './BaseEmail'

interface Props {
  username: string
  action: 'deactivated' | 'deleted'
  reactivateUrl?: string
  trackingPixelUrl?: string
}

export function GoodbyeEmail({ username, action, reactivateUrl, trackingPixelUrl }: Props) {
  const isDeactivated = action === 'deactivated'

  return (
    <BaseEmail
      subject={isDeactivated ? 'Your EatForkful account has been deactivated' : 'Your EatForkful account has been deleted'}
      previewText={isDeactivated
        ? 'Your account is deactivated. You can reactivate it any time by logging back in.'
        : 'Your EatForkful account and data have been permanently deleted.'}
      variant="functional"
      trackingPixelUrl={trackingPixelUrl}
    >
      <p style={{ margin: '0 0 8px', fontSize: 13, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Account Update
      </p>
      <h1 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 700, color: '#09090b' }}>
        Sorry to see you go, {username}
      </h1>

      {isDeactivated ? (
        <>
          <p style={{ margin: '0 0 16px' }}>
            Your EatForkful account has been <strong>deactivated</strong>. Your recipes, pantry, and
            preferences are all safely stored — nothing has been deleted.
          </p>
          <p style={{ margin: '0 0 24px' }}>
            Whenever you&apos;re ready to come back, just log in and confirm you&apos;d like to
            reactivate. It only takes a moment.
          </p>
          {reactivateUrl && (
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
                      Log in to EatForkful
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </>
      ) : (
        <>
          <p style={{ margin: '0 0 16px' }}>
            Your EatForkful account has been <strong>permanently deleted</strong>. All your private
            recipes, pantry items, and personal data have been removed.
          </p>
          <p style={{ margin: '0 0 24px' }}>
            If you shared any public recipes, they will remain visible but will no longer be
            attributed to your account.
          </p>
          <p style={{ margin: '0 0 24px' }}>
            If this was a mistake or you have questions, please reach out to us at{' '}
            <a href="mailto:hello@eatforkful.com" style={{ color: '#10b981' }}>hello@eatforkful.com</a>.
          </p>
        </>
      )}

      <p style={{ margin: 0, fontSize: 13, color: '#71717a' }}>
        Thanks for being part of EatForkful. We hope to see you again.
      </p>
    </BaseEmail>
  )
}
