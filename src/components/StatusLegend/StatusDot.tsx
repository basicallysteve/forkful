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
 * collapses to a colour-coded dot on narrow ones (<=720px). The label stays
 * available to screen readers via `role="img"` + `aria-label`, and to sighted
 * users via the per-page legend plus a hover/press tooltip. Deliberately not
 * focusable: making every dot a tab stop across long lists harms keyboard
 * navigation, and the accessible name already covers assistive tech. See the
 * Status Dot entry in CONTEXT.md.
 */
export default function StatusDot({ variant, label }: StatusDotProps) {
  return (
    <span className={`status-dot status-dot--${variant}`} role="img" aria-label={label} data-label={label}>
      <span className="status-dot__indicator" aria-hidden="true" />
      <span className="status-dot__label">{label}</span>
    </span>
  )
}
