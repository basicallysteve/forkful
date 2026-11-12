'use client'

import { useRef, useState } from 'react'
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
  const menuId = `pantry-row-menu-${itemId}`

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
    <div className="pantry-row-actions">
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
