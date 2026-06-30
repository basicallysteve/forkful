'use client'

import './status-legend.scss'

export type StatusVariant =
  | 'good'
  | 'expiring-soon'
  | 'expired'
  | 'frozen'
  | 'prepared'
  | 'unpublished'
  | 'in-use'

interface StatusDotProps {
  variant: StatusVariant
  label: string
}

/**
 * A status indicator that renders as a full-text pill on wide screens and
 * collapses to a colour-coded dot on narrow ones (<=720px). On mobile the
 * label stays available to screen readers via `aria-label` and to sighted
 * users via a tap/hover tooltip. See the Status Dot entry in CONTEXT.md.
 */
export default function StatusDot({ variant, label }: StatusDotProps) {
  return (
    <span
      className={`status-dot status-dot--${variant}`}
      role="img"
      aria-label={label}
      data-label={label}
      tabIndex={0}
    >
      <span className="status-dot__indicator" aria-hidden="true" />
      <span className="status-dot__label">{label}</span>
    </span>
  )
}
