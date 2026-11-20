import { useRef, useState } from 'react'

/**
 * Shared bookkeeping for the search comboboxes' live status.
 *
 * - `open` follows PrimeReact's overlay (`onShow`/`onHide`), so result counts are only
 *   announced while the list is actually showing.
 * - PrimeReact refocuses the input right after a select, which fires `onFocus` and would
 *   re-run the search. Call `markSelected()` in the select handler and check
 *   `isRefocusAfterSelect()` in the focus handler to skip that search.
 */
export function useAutocompleteList() {
  const [open, setOpen] = useState(false)
  const selecting = useRef(false)

  return {
    open,
    listProps: { onShow: () => setOpen(true), onHide: () => setOpen(false) },
    markSelected() {
      selecting.current = true
      setTimeout(() => { selecting.current = false }, 0)
    },
    isRefocusAfterSelect: () => selecting.current,
  }
}
