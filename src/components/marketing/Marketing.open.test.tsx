import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../ThemedLogo', () => ({ default: () => null }))
import MarketingNav from './MarketingNav'
import MarketingFooter from './MarketingFooter'
import { InviteOnlyProvider } from '@/components/InviteOnlyProvider'

describe('marketing nav and footer with the invite-only flag off (#374)', () => {
  it('nav offers "Get started free" to /create-account, not the waitlist', () => {
    render(<InviteOnlyProvider value={false}><MarketingNav /></InviteOnlyProvider>)
    expect(screen.getByRole('link', { name: 'Get started free' })).toHaveAttribute('href', '/create-account')
    expect(screen.queryByRole('link', { name: 'Join the waitlist' })).not.toBeInTheDocument()
  })

  it('footer offers "Sign up" to /create-account, not the waitlist', () => {
    render(<InviteOnlyProvider value={false}><MarketingFooter /></InviteOnlyProvider>)
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/create-account')
    expect(screen.queryByRole('link', { name: 'Join the waitlist' })).not.toBeInTheDocument()
  })

  it('stays in waitlist mode when the flag is on', () => {
    render(<InviteOnlyProvider value={true}><MarketingNav /></InviteOnlyProvider>)
    expect(screen.getByRole('link', { name: 'Join the waitlist' })).toHaveAttribute('href', '/waitlist')
  })
})
