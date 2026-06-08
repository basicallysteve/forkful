import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ToolBar from './ToolBar'

vi.mock('./ThemeToggle', () => ({
  default: () => <button type="button" aria-label="Switch to dark mode" />,
}))

const leftOptions = [
  { label: 'Recipes', to: '/recipes' },
  { label: 'Foods', to: '/foods' },
]

const rightOptions = [
  { label: 'stevent', to: '/profile', align: 'right' as const },
  { label: 'Logout', to: '/logout', align: 'right' as const },
]

const optionsWithChildren = [
  {
    label: 'Recipes',
    to: '/recipes',
    children: [
      { label: 'Browse All Recipes', to: '/recipes' },
      { label: 'Add New Recipe', to: '/recipes/new' },
    ],
  },
  { label: 'stevent', to: '/profile', align: 'right' as const },
  { label: 'Logout', to: '/logout', align: 'right' as const },
]

describe('ToolBar — desktop layout', () => {
  it('renders the brand logo and name', () => {
    render(<ToolBar />)
    expect(screen.getByAltText('Forkful logo')).toBeInTheDocument()
    expect(screen.getByText('Forkful')).toBeInTheDocument()
  })

  it('renders left nav links', () => {
    render(<ToolBar menuOptions={leftOptions} />)
    expect(screen.getAllByRole('link', { name: /recipes/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /foods/i }).length).toBeGreaterThan(0)
  })

  it('renders right-aligned links', () => {
    render(<ToolBar menuOptions={[...leftOptions, ...rightOptions]} />)
    expect(screen.getAllByRole('link', { name: /stevent/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /logout/i }).length).toBeGreaterThan(0)
  })

  it('renders options with children as buttons with a caret', () => {
    render(<ToolBar menuOptions={optionsWithChildren} />)
    const trigger = screen.getAllByRole('button', { name: /recipes/i })[0]
    expect(trigger).toBeInTheDocument()
    expect(trigger.textContent).toContain('▾')
  })
})

describe('ToolBar — mobile drawer', () => {
  it('renders the hamburger button', () => {
    render(<ToolBar menuOptions={leftOptions} />)
    expect(screen.getByRole('button', { name: /open navigation menu/i })).toBeInTheDocument()
  })

  it('drawer is not visible before opening', () => {
    render(<ToolBar menuOptions={leftOptions} />)
    const nav = screen.getByRole('navigation', { name: /navigation menu/i })
    expect(nav).not.toHaveClass('drawer--open')
  })

  it('opens the drawer when hamburger is clicked', () => {
    render(<ToolBar menuOptions={leftOptions} />)
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
    const nav = screen.getByRole('navigation', { name: /navigation menu/i })
    expect(nav).toHaveClass('drawer--open')
  })

  it('closes the drawer when the close button is clicked', () => {
    render(<ToolBar menuOptions={leftOptions} />)
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
    fireEvent.click(screen.getByRole('button', { name: /close navigation menu/i }))
    const nav = screen.getByRole('navigation', { name: /navigation menu/i })
    expect(nav).not.toHaveClass('drawer--open')
  })

  it('closes the drawer when the backdrop is clicked', () => {
    render(<ToolBar menuOptions={leftOptions} />)
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
    const backdrop = document.querySelector('.drawer-backdrop')!
    fireEvent.click(backdrop)
    const nav = screen.getByRole('navigation', { name: /navigation menu/i })
    expect(nav).not.toHaveClass('drawer--open')
  })

  it('shows all nav links inside the drawer', () => {
    render(<ToolBar menuOptions={[...leftOptions, ...rightOptions]} />)
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
    const drawer = screen.getByRole('navigation', { name: /navigation menu/i })
    expect(drawer).toHaveTextContent('Recipes')
    expect(drawer).toHaveTextContent('Foods')
    expect(drawer).toHaveTextContent('stevent')
    expect(drawer).toHaveTextContent('Logout')
  })

  it('shows submenu children inline in the drawer', () => {
    render(<ToolBar menuOptions={optionsWithChildren} />)
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
    const drawer = screen.getByRole('navigation', { name: /navigation menu/i })
    expect(drawer).toHaveTextContent('Browse All Recipes')
    expect(drawer).toHaveTextContent('Add New Recipe')
  })

  it('closes the drawer after clicking a link inside it', () => {
    render(<ToolBar menuOptions={leftOptions} />)
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
    const drawer = screen.getByRole('navigation', { name: /navigation menu/i })
    const links = drawer.querySelectorAll('a')
    fireEvent.click(links[0])
    expect(drawer).not.toHaveClass('drawer--open')
  })

  it('hamburger aria-expanded reflects drawer state', () => {
    render(<ToolBar menuOptions={leftOptions} />)
    const hamburger = screen.getByRole('button', { name: /open navigation menu/i })
    expect(hamburger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(hamburger)
    expect(hamburger).toHaveAttribute('aria-expanded', 'true')
  })
})
