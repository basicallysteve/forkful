import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import WaitlistLeaveView from './WaitlistLeaveView'

describe('WaitlistLeaveView', () => {
  it('confirms removal', () => {
    render(<WaitlistLeaveView status="removed" />)
    expect(screen.getByText("You've been removed from the waitlist")).toBeInTheDocument()
  })

  it('says the link is invalid', () => {
    render(<WaitlistLeaveView status="invalid" />)
    expect(screen.getByText('This link is invalid')).toBeInTheDocument()
    expect(screen.queryByText(/removed from the waitlist/i)).not.toBeInTheDocument()
  })

  it('does not steal focus on a plain page load', () => {
    render(<WaitlistLeaveView status="invalid" />)
    expect(screen.getByRole('heading')).not.toHaveFocus()
  })
})
