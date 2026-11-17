import type { ReactNode } from 'react'
import './autocomplete-status.scss'

/** "1 result" / "N results" announcement for a non-empty suggestion list. */
export function resultsMessage(count: number): string {
  return count === 1 ? '1 result' : `${count} results`
}

type AutocompleteStatusProps = {
  /** Text announced politely when it changes. Empty renders an empty (silent) region. */
  message: string
  /** Show the message on screen (an empty state). By default it is announced only. */
  visible?: boolean
  /** Extra class for the owner's own styling, e.g. `pantry-search-empty`. */
  className?: string
  /** Visible only: controls shown after the message (outside the live region), e.g. a "Scan a barcode" button. */
  children?: ReactNode
}

/**
 * The one live region of a search combobox. It is always mounted (screen readers only
 * announce changes to a region that already exists) and carries "Searching…", "N results"
 * and "No matches". Announcement-only text is visually hidden; an empty state can opt in
 * to being shown with `visible`.
 */
export default function AutocompleteStatus({ message, visible = false, className, children }: AutocompleteStatusProps) {
  const showing = visible && !!message
  const classes = ['autocomplete-status', showing ? 'autocomplete-status--visible' : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  // Only the message is the live region, so controls beside it are not read out with it.
  return (
    <div className={classes}>
      <span role="status" aria-live="polite" className={showing ? undefined : 'autocomplete-status-sr'}>
        {message}
      </span>
      {showing && children ? <> {children}</> : null}
    </div>
  )
}
