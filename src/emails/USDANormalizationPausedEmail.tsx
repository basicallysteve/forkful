import { BaseEmail } from './BaseEmail'

interface Props {
  remaining: number
}

export function USDANormalizationPausedEmail({ remaining }: Props) {
  return (
    <BaseEmail
      subject="USDA normalization paused — Anthropic credits exhausted"
      previewText={`${remaining.toLocaleString()} foods still need normalizing — top up Anthropic credits to resume`}
      variant="functional"
    >
      <p style={{ margin: '0 0 8px', fontSize: 13, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Migration paused
      </p>
      <p style={{ margin: '0 0 16px' }}>
        The USDA name normalization cron has paused because your Anthropic API credits are exhausted.
      </p>
      <p style={{ margin: '0 0 16px' }}>
        <strong>{remaining.toLocaleString()}</strong> food{remaining !== 1 ? 's' : ''} still need normalizing.
      </p>
      <p style={{ margin: 0 }}>
        Top up your Anthropic credits and the cron will resume automatically on its next hourly run.
      </p>
    </BaseEmail>
  )
}
