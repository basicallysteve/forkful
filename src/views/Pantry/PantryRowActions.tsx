'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from 'primereact/button'
import { Menu } from 'primereact/menu'
import type { MenuItem, MenuItemOptions } from 'primereact/menuitem'

type PantryRowActionsProps = {
  itemId: number
  itemName: string
  frozen: boolean
  onFreeze: () => void
  onThaw: () => void
  onDelete: () => void
}

// Overflow menu that replaces the inline Freeze / Edit / Delete buttons in the mid-width table range.
// Delete sits last, behind a separator, so it can't be hit by a slip meant for Edit.
export default function PantryRowActions({ itemId, itemName, frozen, onFreeze, onThaw, onDelete }: PantryRowActionsProps) {
  const menu = useRef<Menu>(null)
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const menuId = `pantry-row-menu-${itemId}`

  // The popup is positioned once on open, so a resize would leave it detached from its trigger.
  useEffect(() => {
    if (!open) return
    // Menu.hide(event) stores event.currentTarget as the overlay target, and PrimeReact's own resize
    // handler repositions against it, so it must be the trigger element (a window there throws
    // "getBoundingClientRect is not a function"). hide() only reads currentTarget, hence the narrow
    // cast: PrimeReact types it as a React.SyntheticEvent and offers no typed alternative.
    const trigger = wrapper.current?.querySelector<HTMLElement>('.pantry-row-actions-trigger')
    if (!trigger) return
    const close = () => menu.current?.hide({ currentTarget: trigger } as unknown as React.SyntheticEvent)
    window.addEventListener('resize', close)
    return () => window.removeEventListener('resize', close)
  }, [open])

  // The popup is portalled to <body>, so Tab out of it would land far from the row. React still bubbles
  // its key events through this wrapper (target outside the wrapper's DOM): PrimeReact closes the menu,
  // and we return focus to the trigger so the next Tab continues from there and Enter reopens it.
  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || wrapper.current?.contains(event.target as Node)) return
    event.preventDefault()
    wrapper.current?.querySelector<HTMLElement>('.pantry-row-actions-trigger')?.focus()
  }

  function commandItem(label: string, command: () => void, extraClass = ''): MenuItem {
    return {
      label,
      command,
      template: (item: MenuItem, options: MenuItemOptions) => (
        <button type="button" tabIndex={-1} role="presentation" className={`${options.className} pantry-menu-action ${extraClass}`.trim()}>
          {item.label}
        </button>
      ),
    }
  }

  const items: MenuItem[] = [
    frozen ? commandItem('Thaw', onThaw) : commandItem('Freeze', onFreeze),
    {
      label: 'Edit',
      template: (item: MenuItem, options: MenuItemOptions) => (
        <Link href={`/pantry/${itemId}/edit`} tabIndex={-1} role="presentation" className={`${options.className} pantry-menu-action`} data-pc-section="action">
          {item.label}
        </Link>
      ),
    },
    { separator: true },
    commandItem('Delete', onDelete, 'pantry-menu-danger'),
  ]

  return (
    <div className="pantry-row-actions" ref={wrapper} onKeyDown={handleMenuKeyDown}>
      <Menu model={items} popup ref={menu} id={menuId} popupAlignment="right" className="pantry-row-menu" onShow={() => setOpen(true)} onHide={() => setOpen(false)} appendTo={typeof document === 'undefined' ? undefined : document.body} />
      <Button
        type="button"
        icon="pi pi-ellipsis-h"
        text
        rounded
        className="pantry-row-actions-trigger"
        aria-label={`Actions for ${itemName}`}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-expanded={open}
        onClick={(event) => menu.current?.toggle(event)}
      />
    </div>
  )
}
