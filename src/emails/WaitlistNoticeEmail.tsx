import { BaseEmail } from './BaseEmail'

interface Props {
  username: string
  /** Signed leave-the-waitlist link (see `signWaitlistLeaveToken`). */
  leaveUrl: string
}

export function waitlistNoticeText(username: string, leaveUrl: string): string {
  return [
    `Hi ${username}, EatForkful is invite-only for now. Your account is on the waitlist and your recipes, pantry and food log are safe. We'll email you when your invite is ready.`,
    '',
    "If you'd rather not wait, you can leave the waitlist and deactivate your account:",
    leaveUrl,
  ].join('\n')
}

export function WaitlistNoticeEmail({ username, leaveUrl }: Props) {
  return (
    <BaseEmail
      subject="You're on the EatForkful waitlist"
      previewText="EatForkful is invite-only for now. Your data is safe."
      variant="functional"
    >
      <p style={{ margin: '0 0 16px' }}>
        Hi {username}, EatForkful is invite-only for now. Your account is on the waitlist and your recipes, pantry and
        food log are safe. We&apos;ll email you when your invite is ready.
      </p>

      <p style={{ margin: '0 0 4px' }}>
        If you&apos;d rather not wait, you can leave the waitlist and deactivate your account:
      </p>
      <p style={{ margin: 0 }}>
        <a href={leaveUrl} style={{ color: '#10b981', textDecoration: 'underline' }}>
          Leave the waitlist
        </a>
      </p>
    </BaseEmail>
  )
}
