import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/mdx', () => ({ getAllPosts: () => [] }))

import { metadata } from './page'

describe('blog index metadata', () => {
  it('has a plain title so the root template adds the brand once', () => {
    expect(metadata.title).toBe('Blog')
  })

  it('has an absolute canonical URL', () => {
    expect(String(metadata.alternates?.canonical)).toMatch(/^https?:\/\/.+\/blog$/)
  })

  it('uses an absolute Open Graph image', () => {
    const images = metadata.openGraph?.images as { url: string }[]
    expect(images[0].url).toMatch(/^https?:\/\/.+\/opengraph-image$/)
  })
})
