import { useEffect } from 'react'
import type { RefObject } from 'react'

/**
 * Keeps `aria-activedescendant` on the combobox input pointing at the highlighted option.
 *
 * PrimeReact 10.9.7 tracks the keyboard highlight imperatively: it sets
 * `data-p-highlight="true"` on the `<li role="option">` and exposes neither an option id
 * nor a controlled focused index. So this watches the listbox (which PrimeReact renders in
 * a portal, found through the input's `aria-controls`) and mirrors that attribute into
 * `aria-activedescendant`, giving the option a stable id first. It only observes while the
 * input has focus. Drop it when moving to PrimeReact v11 (#233) if that sets this natively.
 */
export function useActiveDescendant(containerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let input: HTMLInputElement | null = null
    let observer: MutationObserver | null = null

    function sync() {
      if (!input) return
      const listId = input.getAttribute('aria-controls')
      const list = listId ? document.getElementById(listId) : null
      const active = list?.querySelector<HTMLElement>('[role="option"][data-p-highlight="true"]') ?? null
      if (!list || !active) {
        input.removeAttribute('aria-activedescendant')
        return
      }
      if (!active.id) {
        const index = Array.from(list.querySelectorAll('[role="option"]')).indexOf(active)
        active.id = `${listId}_option_${index}`
      }
      input.setAttribute('aria-activedescendant', active.id)
    }

    function stop() {
      observer?.disconnect()
      observer = null
      input?.removeAttribute('aria-activedescendant')
      input = null
    }

    function onFocusIn(e: FocusEvent) {
      const target = e.target
      if (!(target instanceof HTMLInputElement) || target.getAttribute('role') !== 'combobox') return
      stop()
      input = target
      observer = new MutationObserver(sync)
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-p-highlight', 'aria-controls'],
      })
      sync()
    }

    function onFocusOut(e: FocusEvent) {
      if (e.target === input) stop()
    }

    container.addEventListener('focusin', onFocusIn)
    container.addEventListener('focusout', onFocusOut)
    return () => {
      container.removeEventListener('focusin', onFocusIn)
      container.removeEventListener('focusout', onFocusOut)
      stop()
    }
  }, [containerRef])
}
