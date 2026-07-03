import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrivacyPage, { generateMetadata } from './page'

vi.mock('next-mdx-remote/rsc', () => ({
  MDXRemote: ({ source }: { source: string }) => <div data-testid="mdx-content">{source}</div>,
}))

describe('PrivacyPage', () => {
  it('renders privacy policy content from markdown', () => {
    render(<PrivacyPage />)

    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument()
    expect(screen.getByRole('time')).toHaveAttribute('dateTime', '2026-07-02')
    expect(screen.getByTestId('mdx-content')).toHaveTextContent('Thank you for using Forkful.')
  })

  it('sets metadata from legal content frontmatter', async () => {
    const metadata = await generateMetadata()

    expect(metadata.title).toBe('Privacy Policy')
    expect(metadata.description).toBe('How Forkful collects, uses, and protects your personal data.')
  })
})
