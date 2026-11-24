import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from './index'
import { InviteOnlyProvider } from '@/components/InviteOnlyProvider'

describe('Home hero CTA with the invite-only flag off (#374)', () => {
  it('offers "Get started free" to /create-account instead of the waitlist', () => {
    render(<InviteOnlyProvider value={false}><Home isAuthenticated={false} recipes={[]} /></InviteOnlyProvider>)
    expect(screen.getByRole('link', { name: 'Get started free' })).toHaveAttribute('href', '/create-account')
    expect(screen.queryByRole('link', { name: /join the waitlist/i })).not.toBeInTheDocument()
  })
})
