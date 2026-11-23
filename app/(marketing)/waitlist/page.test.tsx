import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import WaitlistPage, { metadata } from './page'

describe('/waitlist page', () => {
  it('renders the join form', () => {
    render(<WaitlistPage />)
    expect(screen.getByRole('heading', { name: /waitlist/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('has a title', () => {
    expect(metadata.title).toBeTruthy()
  })
})
