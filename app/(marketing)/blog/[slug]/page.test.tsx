import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('next-mdx-remote/rsc', () => ({ MDXRemote: () => null }))
vi.mock('@/lib/mdx', () => ({
  getAllPosts: () => [],
  getPost: (slug: string) =>
    slug === 'hello'
      ? { slug: 'hello', title: 'Hello', description: 'A post', date: '2026-06-10', content: 'x' }
      : null,
}))

import BlogPostPage, { generateMetadata } from './page'

const params = (slug: string) => ({ params: Promise.resolve({ slug }) })

describe('blog post metadata', () => {
  it('sets canonical, article type, publishedTime and an absolute image', async () => {
    const m = await generateMetadata(params('hello'))
    expect(m.title).toBe('Hello')
    expect(String(m.alternates?.canonical)).toMatch(/^https?:\/\/.+\/blog\/hello$/)
    expect(m.openGraph).toMatchObject({ type: 'article', publishedTime: '2026-06-10' })
    const images = m.openGraph?.images as { url: string }[]
    expect(images[0].url).toMatch(/^https?:\/\/.+\/opengraph-image$/)
  })

  it('returns empty metadata for an unknown post', async () => {
    expect(await generateMetadata(params('nope'))).toEqual({})
  })
})

describe('blog post page JSON-LD', () => {
  it('renders a parseable BlogPosting script', async () => {
    const ui = await BlogPostPage(params('hello'))
    const { container } = render(ui)
    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).not.toBeNull()
    const ld = JSON.parse(script!.textContent!)
    expect(ld['@type']).toBe('BlogPosting')
    expect(ld.headline).toBe('Hello')
  })
})
