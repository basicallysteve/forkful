/**
 * BaseEmail — shared email shell.
 *
 * variant="functional"  Clean, minimal transactional layout (white card on
 *                        light grey). Use for password resets, confirmations,
 *                        alerts, etc.
 *
 * variant="marketing"   Branded layout with an EatForkful green header. Use for
 *                        newsletters, announcements, and promotional emails.
 *
 * Pass trackingPixelUrl to embed a 1×1 transparent tracking pixel at the
 * bottom of the email so opens can be counted server-side.
 */

interface BaseEmailProps {
  subject: string
  /** Short preview text shown by email clients before the message is opened. */
  previewText?: string
  variant: 'functional' | 'marketing'
  /** URL of the 1×1 tracking pixel, e.g. /api/track/email-open?id=<uuid> */
  trackingPixelUrl?: string
  children: React.ReactNode
}

// ── Shared token values ────────────────────────────────────────────────────────

const BRAND_GREEN  = '#10b981'
const CARD_BG      = '#ffffff'
const OUTER_BG     = '#f4f4f5'
const BORDER_COLOR = '#e4e4e7'
const FOOTER_TEXT  = '#a1a1aa'
const BODY_TEXT    = '#3f3f46'
const MUTED_TEXT   = '#71717a'
// const HEADING_TEXT = '#09090b'

// ── Variant-specific headers ──────────────────────────────────────────────────

function FunctionalHeader() {
  return (
    <tr>
      <td style={{ padding: '28px 40px 20px', borderBottom: `1px solid ${BORDER_COLOR}` }}>
        <p style={{ margin: 0, fontSize: 12, color: MUTED_TEXT, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          EatForkful
        </p>
      </td>
    </tr>
  )
}

function MarketingHeader() {
  return (
    <tr>
      <td style={{ padding: '32px 40px', backgroundColor: BRAND_GREEN, borderRadius: '12px 12px 0 0' }}>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.3px' }}>
          EatForkful
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
          Your personal recipe kitchen
        </p>
      </td>
    </tr>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BaseEmail({ subject, previewText, variant, trackingPixelUrl, children }: BaseEmailProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{subject}</title>
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: OUTER_BG, fontFamily: 'sans-serif' }}>

        {/* Hidden preview text — padded with zero-width spaces to prevent
            email clients from pulling in other content after it. */}
        {previewText && (
          <div style={{ display: 'none', maxHeight: 0, overflow: 'hidden', fontSize: 1, color: OUTER_BG }}>
            {previewText}
            {'‌ '.repeat(100)}
          </div>
        )}

        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: OUTER_BG, padding: '40px 16px' }}>
          <tbody>
            <tr>
              <td align="center">
                <table
                  width="100%"
                  cellPadding={0}
                  cellSpacing={0}
                  style={{ maxWidth: 560, backgroundColor: CARD_BG, borderRadius: 12, overflow: 'hidden' }}
                >
                  <tbody>
                    {variant === 'marketing' ? <MarketingHeader /> : <FunctionalHeader />}

                    {/* Email body — supplied by the caller */}
                    <tr>
                      <td style={{ padding: '28px 40px', fontSize: 15, lineHeight: 1.6, color: BODY_TEXT }}>
                        {children}
                      </td>
                    </tr>

                    {/* Footer */}
                    <tr>
                      <td style={{ padding: '20px 40px 32px', borderTop: `1px solid ${BORDER_COLOR}` }}>
                        <p style={{ margin: 0, fontSize: 12, color: FOOTER_TEXT, lineHeight: 1.6 }}>
                          You received this email because you have a EatForkful account.
                          If you didn&apos;t expect it, you can safely ignore it.
                        </p>
                      </td>
                    </tr>

                    {/* Tracking pixel */}
                    {trackingPixelUrl && (
                      <tr>
                        <td style={{ lineHeight: 0 }}>
                          <img
                            src={trackingPixelUrl}
                            width={1}
                            height={1}
                            alt=""
                            style={{ display: 'block', border: 0 }}
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  )
}
