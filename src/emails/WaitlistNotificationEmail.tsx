import { BaseEmail } from './BaseEmail'

interface Props {
  email: string
  name: string | null
  marketingEmailOptIn: boolean
}

export function WaitlistNotificationEmail({ email, name, marketingEmailOptIn }: Props) {
  return (
    <BaseEmail
      subject="Someone joined the EatForkful waitlist"
      previewText="New waitlist entry"
      variant="functional"
    >
      <p style={{ margin: '0 0 8px', fontSize: 13, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        New Waitlist Entry
      </p>
      <p style={{ margin: '0 0 8px' }}>
        <strong>{name ?? 'No name given'}</strong> ({email}) joined the waitlist.
      </p>
      <p style={{ margin: '0 0 16px' }}>
        Waitlist updates: {marketingEmailOptIn ? 'opted in' : 'not opted in'}.
      </p>
    </BaseEmail>
  )
}
