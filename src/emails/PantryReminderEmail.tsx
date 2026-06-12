import { BaseEmail } from './BaseEmail'

interface ExpiringItem {
  name: string
  expirationDate: string
  daysUntilExpiry: number
}

interface Props {
  username: string
  items: ExpiringItem[]
  pantryUrl: string
  trackingPixelUrl?: string
}

export function PantryReminderEmail({ username, items, pantryUrl, trackingPixelUrl }: Props) {
  const count = items.length
  const previewText = count === 1
    ? `${items[0].name} is expiring soon — check your pantry.`
    : `${count} items in your pantry are expiring soon.`

  return (
    <BaseEmail
      subject="Items in your pantry are expiring soon"
      previewText={previewText}
      variant="functional"
      trackingPixelUrl={trackingPixelUrl}
    >
      <p style={{ margin: '0 0 8px', fontSize: 13, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Pantry Reminder
      </p>
      <h1 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 700, color: '#09090b' }}>
        Hi {username}, time to check your pantry
      </h1>

      <p style={{ margin: '0 0 20px' }}>
        {count === 1
          ? 'The following item in your pantry is expiring soon:'
          : `The following ${count} items in your pantry are expiring soon:`}
      </p>

      <table cellPadding={0} cellSpacing={0} style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#71717a', borderBottom: '1px solid #e4e4e7', fontWeight: 600 }}>
              Item
            </th>
            <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 12, color: '#71717a', borderBottom: '1px solid #e4e4e7', fontWeight: 600 }}>
              Expires
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fafafa' : '#ffffff' }}>
              <td style={{ padding: '10px 12px', fontSize: 14, color: '#09090b', borderBottom: '1px solid #f4f4f5' }}>
                {item.name}
              </td>
              <td style={{ padding: '10px 12px', fontSize: 14, textAlign: 'right', borderBottom: '1px solid #f4f4f5' }}>
                <span style={{ color: item.daysUntilExpiry <= 1 ? '#dc2626' : item.daysUntilExpiry <= 3 ? '#d97706' : '#71717a' }}>
                  {item.daysUntilExpiry <= 0 ? 'Today' : item.daysUntilExpiry === 1 ? 'Tomorrow' : `${item.expirationDate}`}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <table cellPadding={0} cellSpacing={0} style={{ marginBottom: 24 }}>
        <tbody>
          <tr>
            <td style={{ borderRadius: 8, backgroundColor: '#10b981' }}>
              <a
                href={pantryUrl}
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
                View your pantry
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      <p style={{ margin: 0, fontSize: 13, color: '#71717a' }}>
        You can update your pantry reminder preferences in your{' '}
        <a href={pantryUrl.replace('/pantry', '/profile')} style={{ color: '#10b981' }}>account settings</a>.
      </p>
    </BaseEmail>
  )
}
