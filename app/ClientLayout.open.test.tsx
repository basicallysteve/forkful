import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/components/ThemedLogo', () => ({ default: () => null }))
vi.mock('@/components/ToolBar', () => ({ default: () => null }))
vi.mock('@vercel/analytics/next', () => ({ Analytics: () => null }))
vi.mock('@vercel/speed-insights/next', () => ({ SpeedInsights: () => null }))

import ClientLayout from './ClientLayout'

describe('ClientLayout carries the invite-only flag to the marketing shell (#374)', () => {
  it('shows account-creation CTAs when inviteOnly is false', () => {
    render(<ClientLayout isLoggedIn={false} username={null} inviteOnly={false}>x</ClientLayout>)
    expect(screen.getByRole('link', { name: 'Get started free' })).toHaveAttribute('href', '/create-account')
  })

  it('shows the waitlist CTA when inviteOnly is true', () => {
    render(<ClientLayout isLoggedIn={false} username={null} inviteOnly={true}>x</ClientLayout>)
    expect(screen.getAllByRole('link', { name: 'Join the waitlist' })[0]).toHaveAttribute('href', '/waitlist')
  })
})
