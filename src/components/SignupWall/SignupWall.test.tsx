import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SignupWall from './SignupWall'
import { InviteOnlyProvider } from '@/components/InviteOnlyProvider'

describe('SignupWall (ADR-0020 wording, ADR-0032 switch)', () => {
  it('invites to join the waitlist while invite-only is on', () => {
    render(<InviteOnlyProvider value={true}><SignupWall /></InviteOnlyProvider>)
    expect(screen.getByRole('heading', { name: 'Join the waitlist to see the full recipe' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Join the waitlist' })).toHaveAttribute('href', '/waitlist')
  })

  it('invites to create a free account while invite-only is off', () => {
    render(<InviteOnlyProvider value={false}><SignupWall /></InviteOnlyProvider>)
    expect(screen.getByRole('heading', { name: 'Create a free account to see the full recipe' })).toBeInTheDocument()
    const cta = screen.getByRole('link', { name: 'Create a free account' })
    expect(cta.getAttribute('href')).toMatch(/^\/create-account/)
    expect(screen.getByRole('region', { name: 'Create a free account to see the full recipe' })).toBeInTheDocument()
    expect(screen.queryByText(/waitlist/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument()
  })
})
