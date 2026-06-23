import { BaseEmail } from './BaseEmail'

interface Props {
  normalized: number
  failed: number
}

export function USDANormalizationCompleteEmail({ normalized, failed }: Props) {
  return (
    <BaseEmail
      subject="USDA food name normalization complete"
      previewText={`${normalized.toLocaleString()} foods normalized — remove the cron from vercel.json`}
      variant="functional"
    >
      <p style={{ margin: '0 0 8px', fontSize: 13, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Migration complete
      </p>
      <p style={{ margin: '0 0 16px' }}>
        All USDA food names have been normalized.
      </p>
      <p style={{ margin: '0 0 16px' }}>
        <strong>{normalized.toLocaleString()}</strong> foods normalized
        {failed > 0 && <>, <strong>{failed.toLocaleString()}</strong> failed (raw name kept — check logs)</>}.
      </p>
      <p style={{ margin: '0 0 0' }}>
        You can now remove the <code style={{ backgroundColor: '#f4f4f5', padding: '1px 5px', borderRadius: 4 }}>/api/cron/normalize-usda-names</code> entry from <code style={{ backgroundColor: '#f4f4f5', padding: '1px 5px', borderRadius: 4 }}>vercel.json</code>.
      </p>
    </BaseEmail>
  )
}
