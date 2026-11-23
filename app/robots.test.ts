import { describe, expect, it } from 'vitest'
import robots from './robots'

describe('robots', () => {
  const result = robots()
  const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules
  const disallow = ([] as string[]).concat(rule.disallow ?? [])
  const allow = ([] as string[]).concat(rule.allow ?? [])

  it('applies to all crawlers and allows the site root', () => {
    expect(rule.userAgent).toBe('*')
    expect(allow).toContain('/')
  })

  it('blocks the api, admin and signed-in app screens', () => {
    for (const path of ['/api/', '/admin', '/pantry', '/profile', '/shopping-list', '/recipes/new']) {
      expect(disallow).toContain(path)
    }
  })

  it('does not block public pages or recipe detail pages (Crawler Exemption, ADR-0032)', () => {
    for (const path of ['/', '/blog', '/blog/hello', '/about', '/recipes', '/recipes/abc123/some-recipe']) {
      expect(disallow.some(d => path.startsWith(d))).toBe(false)
    }
  })

  it('points at the absolute sitemap URL', () => {
    expect(result.sitemap).toMatch(/^https?:\/\/.+\/sitemap\.xml$/)
  })
})
