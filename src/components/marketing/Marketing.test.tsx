import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../ThemedLogo', () => ({ default: () => null }))
import MarketingNav from './MarketingNav'
import MarketingFooter from './MarketingFooter'

describe('MarketingNav', () => {
  it('offers "Join the waitlist" linking to /waitlist instead of account creation', () => {
    render(<MarketingNav />)
    expect(screen.getByRole('link', { name: 'Join the waitlist' })).toHaveAttribute('href', '/waitlist')
    expect(screen.queryByRole('link', { name: 'Get started free' })).not.toBeInTheDocument()
  })

  it('keeps Log in', () => {
    render(<MarketingNav />)
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login')
  })
})

describe('MarketingFooter', () => {
  it('offers "Join the waitlist" linking to /waitlist instead of sign up', () => {
    render(<MarketingFooter />)
    expect(screen.getByRole('link', { name: 'Join the waitlist' })).toHaveAttribute('href', '/waitlist')
    expect(screen.queryByRole('link', { name: 'Sign up' })).not.toBeInTheDocument()
  })
})
