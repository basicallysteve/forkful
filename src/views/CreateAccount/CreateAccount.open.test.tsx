import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CreateAccount from './CreateAccount'
import { InviteOnlyProvider } from '@/components/InviteOnlyProvider'

describe('CreateAccount with the invite-only flag (#374)', () => {
  it('asks for an Invite code while invite-only is on', () => {
    render(<InviteOnlyProvider value={true}><CreateAccount /></InviteOnlyProvider>)
    expect(screen.getByText('Invite code')).toBeInTheDocument()
  })

  it('has no Invite code field while sign-up is open', () => {
    render(<InviteOnlyProvider value={false}><CreateAccount /></InviteOnlyProvider>)
    expect(screen.queryByText('Invite code')).not.toBeInTheDocument()
  })
})
