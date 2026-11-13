import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PantryRowActions from './PantryRowActions'

// Pass-through Menu that records the currentTarget of every hide event (jsdom can't reproduce
// PrimeReact's resize repositioning, so we assert on what it would be given).
const hideTargets: unknown[] = []
vi.mock('primereact/menu', async (importOriginal) => {
  const actual = await importOriginal<typeof import('primereact/menu')>()
  const React = await import('react')
  const Menu = React.forwardRef<unknown, Record<string, unknown>>((props, ref) => {
    const onHide = props.onHide as ((event: { currentTarget: unknown }) => void) | undefined
    return React.createElement(actual.Menu as never, {
      ...props,
      ref,
      onHide: (event: { currentTarget: unknown }) => {
        hideTargets.push(event.currentTarget)
        onHide?.(event)
      },
    })
  })
  return { ...actual, Menu }
})

function setup(frozen = false) {
  const onFreeze = vi.fn()
  const onThaw = vi.fn()
  const onDelete = vi.fn()
  render(
    <PantryRowActions itemId={7} itemName="Chicken Breast" frozen={frozen} onFreeze={onFreeze} onThaw={onThaw} onDelete={onDelete} />,
  )
  const trigger = screen.getByRole('button', { name: 'Actions for Chicken Breast' })
  return { trigger, onFreeze, onThaw, onDelete }
}

describe('PantryRowActions', () => {
  it('renders an icon-only trigger with an accessible name and menu semantics', () => {
    const { trigger } = setup()
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens a menu with Freeze, Edit and Delete', async () => {
    const user = userEvent.setup()
    const { trigger } = setup()
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('menu', { hidden: true })
    expect(within(menu).getByText('Freeze')).toBeInTheDocument()
    expect(within(menu).getByText('Edit').closest('a')).toHaveAttribute('href', '/pantry/7/edit')
    expect(within(menu).getByText('Delete')).toBeInTheDocument()
    expect(within(menu).queryByText('Thaw')).not.toBeInTheDocument()
  })

  it('shows Thaw instead of Freeze for a frozen item', async () => {
    const user = userEvent.setup()
    const { trigger } = setup(true)
    await user.click(trigger)
    const menu = screen.getByRole('menu', { hidden: true })
    expect(within(menu).getByText('Thaw')).toBeInTheDocument()
    expect(within(menu).queryByText('Freeze')).not.toBeInTheDocument()
  })

  it('calls onFreeze once when Freeze is activated', async () => {
    const user = userEvent.setup()
    const { trigger, onFreeze, onThaw, onDelete } = setup()
    await user.click(trigger)
    await user.click(screen.getByText('Freeze'))
    expect(onFreeze).toHaveBeenCalledTimes(1)
    expect(onThaw).not.toHaveBeenCalled()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('calls onThaw once when Thaw is activated', async () => {
    const user = userEvent.setup()
    const { trigger, onFreeze, onThaw } = setup(true)
    await user.click(trigger)
    await user.click(screen.getByText('Thaw'))
    expect(onThaw).toHaveBeenCalledTimes(1)
    expect(onFreeze).not.toHaveBeenCalled()
  })

  it('calls onDelete once when Delete is activated', async () => {
    const user = userEvent.setup()
    const { trigger, onDelete, onFreeze } = setup()
    await user.click(trigger)
    await user.click(screen.getByText('Delete'))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onFreeze).not.toHaveBeenCalled()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const { trigger } = setup()
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'))
  })

  it('activates Edit from the keyboard by clicking its link', async () => {
    const user = userEvent.setup()
    const { trigger } = setup()
    await user.click(trigger)
    const link = screen.getByText('Edit').closest('a') as HTMLAnchorElement
    const clicked = vi.fn((event: Event) => event.preventDefault())
    link.addEventListener('click', clicked)
    await user.keyboard('{ArrowDown}{Enter}')
    expect(clicked).toHaveBeenCalledTimes(1)
  })

  it('puts Delete last, after a separator, with danger styling', async () => {
    const user = userEvent.setup()
    const { trigger } = setup()
    await user.click(trigger)
    const menu = screen.getByRole('menu', { hidden: true })
    const rows = Array.from(menu.querySelectorAll('li'))
    const separatorIndex = rows.findIndex((li) => li.getAttribute('role') === 'separator')
    const deleteIndex = rows.findIndex((li) => li.textContent?.includes('Delete'))
    expect(separatorIndex).toBeGreaterThan(-1)
    expect(deleteIndex).toBe(rows.length - 1)
    expect(separatorIndex).toBe(deleteIndex - 1)
    expect(rows[deleteIndex].querySelector('.pantry-menu-danger')).not.toBeNull()
  })

  it('closes when the window is resized while open, so it is not left detached from the trigger', async () => {
    const user = userEvent.setup()
    const { trigger } = setup()
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent(window, new Event('resize'))
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('hides against the trigger, not the window, on resize (PrimeReact repositions against the stored target)', async () => {
    const user = userEvent.setup()
    const { trigger } = setup()
    hideTargets.length = 0
    await user.click(trigger)
    fireEvent(window, new Event('resize'))
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'))
    // Window as the stored target makes PrimeReact's own resize handler throw
    // "target.getBoundingClientRect is not a function" in a real browser.
    // Compare by identity, printing only a label (a window in a failure diff is enormous).
    expect(hideTargets.map((target) => (target === trigger ? 'trigger' : target instanceof Element ? 'other element' : 'not an element (window)'))).toEqual(['trigger'])
  })

  it('closes on Tab and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    const { trigger } = setup()
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{Tab}')
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'))
    expect(trigger).toHaveFocus()
  })

  it('closes on Shift+Tab and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    const { trigger } = setup()
    await user.click(trigger)
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'))
    expect(trigger).toHaveFocus()
  })
})
