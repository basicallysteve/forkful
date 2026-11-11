'use client'

import { type StatusVariant } from './StatusDot'
import './status-legend.scss'

export interface StatusLegendItem {
  variant: StatusVariant
  label: string
}

interface StatusLegendProps {
  items: StatusLegendItem[]
}

/**
 * A mobile-only key mapping each colour-coded Status Dot to its meaning.
 * Hidden on wide screens, where cards display full-text status badges instead.
 * Each page passes only the statuses that appear on it. See the Status Legend
 * entry in CONTEXT.md.
 */
export default function StatusLegend({ items }: StatusLegendProps) {
  if (items.length === 0) return null

  return (
    <div className="status-legend" role="list" aria-label="Status key">
      {items.map((item) => (
        <span key={item.variant} className="status-legend__item" role="listitem">
          <span className={`status-dot__indicator status-dot--${item.variant}`} aria-hidden="true" />
          <span className="status-legend__label">{item.label}</span>
        </span>
      ))}
    </div>
  )
}
