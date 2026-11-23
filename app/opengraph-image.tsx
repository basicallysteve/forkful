import { ImageResponse } from 'next/og'

export const alt = 'EatForkful: recipes worth repeating'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Brand colours from public/forkful-logo.svg
const GREEN_LIGHT = '#10b981'
const GREEN_DARK = '#064e3b'

/**
 * Default Open Graph image. Drawn in JSX (no binary asset to keep in sync), using the
 * logo's fork-with-glasses mark and gradient.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 56,
          background: `linear-gradient(135deg, ${GREEN_LIGHT}, ${GREEN_DARK})`,
          color: '#ffffff',
        }}
      >
        <svg width="260" height="260" viewBox="0 0 64 64">
          <g stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M24 10v13M32 10v13M40 10v13" />
            <path d="M24 19h16" />
            <path d="M32 23v23" />
          </g>
          <g fill="none" stroke="#a7f3d0" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="24" cy="34" r="7" />
            <circle cx="40" cy="34" r="7" />
            <path d="M31 34h9" />
          </g>
          <path d="M17 34h7M47 34h-7" stroke="#6ee7b7" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 120, fontWeight: 700, lineHeight: 1 }}>EatForkful</div>
          <div style={{ fontSize: 48, marginTop: 20, color: '#d1fae5' }}>Recipes worth repeating</div>
        </div>
      </div>
    ),
    size,
  )
}
