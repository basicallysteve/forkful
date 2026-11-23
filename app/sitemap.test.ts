import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/mdx', () => ({
  getAllPosts: () => [
    { slug: 'newer', title: 'Newer', description: '', date: '2026-07-01' },
    { slug: 'older', title: 'Older', description: '', date: '2026-06-10' },
  ],
}))

import sitemap from './sitemap'

describe('sitemap', () => {
  const entries = sitemap()
  const urls = entries.map(e => new URL(e.url).pathname)

  it('lists the marketing pages and the blog index', () => {
    for (const path of ['/', '/about', '/privacy', '/terms', '/blog']) {
      expect(urls).toContain(path)
    }
  })

  it('lists every blog post with lastModified from the post date', () => {
    const newer = entries.find(e => e.url.endsWith('/blog/newer'))
    expect(newer?.lastModified).toEqual(new Date('2026-07-01'))
    expect(urls).toContain('/blog/older')
  })

  it('uses absolute URLs', () => {
    for (const e of entries) expect(e.url).toMatch(/^https?:\/\//)
  })

  it('does not list signed-in app screens, auth, admin, api or recipe pages', () => {
    const banned = ['/api', '/admin', '/profile', '/pantry', '/shopping-list', '/log', '/login', '/create-account', '/welcome', '/foods', '/recipes']
    for (const path of urls) {
      expect(banned.some(b => path === b || path.startsWith(`${b}/`))).toBe(false)
    }
  })
})
