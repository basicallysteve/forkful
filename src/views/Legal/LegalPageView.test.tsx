import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LegalPageView from './LegalPageView'

describe('LegalPageView', () => {
  it('renders the page title', () => {
    render(
      <LegalPageView title="Terms & Conditions">
        <p>Some legal content</p>
      </LegalPageView>
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Terms & Conditions')
  })

  it('renders the effective date when provided', () => {
    render(
      <LegalPageView title="Terms & Conditions" effectiveDate="2026-07-02">
        <p>Some legal content</p>
      </LegalPageView>
    )
    expect(screen.getByText(/effective/i)).toBeInTheDocument()
    expect(screen.getByRole('time')).toHaveAttribute('dateTime', '2026-07-02')
  })

  it('omits the effective date when not provided', () => {
    render(
      <LegalPageView title="Terms & Conditions">
        <p>Some legal content</p>
      </LegalPageView>
    )
    expect(screen.queryByRole('time')).not.toBeInTheDocument()
  })

  it('renders children content', () => {
    render(
      <LegalPageView title="Terms & Conditions">
        <p>Governing law section</p>
      </LegalPageView>
    )
    expect(screen.getByText('Governing law section')).toBeInTheDocument()
  })
})
