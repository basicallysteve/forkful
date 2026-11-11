import { BaseEmail } from './BaseEmail'

interface Props {
  username: string
}

export function NewUserNotificationEmail({ username }: Props) {

  return (
    <BaseEmail
      subject={'A new user has joined EatForkful!'}
      previewText={`New user signed up: ${username}`}
      variant="functional"
    >
      <p style={{ margin: '0 0 8px', fontSize: 13, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        New User Alert
      </p>
      <p style={{ margin: '0 0 16px' }}>
        A new user has just signed up for EatForkful with the username: <strong>{username}</strong>.
      </p>
    </BaseEmail>
  )
}
