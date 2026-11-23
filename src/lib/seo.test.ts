import { afterEach, describe, expect, it, vi } from 'vitest'
import { absoluteUrl, blogPostingJsonLd, getSiteUrl, serializeJsonLd, DEFAULT_OG_IMAGE_PATH } from '@/lib/seo'

afterEach(() => vi.unstubAllEnvs())

describe('getSiteUrl', () => {
  it('uses AUTH_URL, the same origin the email links use', () => {
    vi.stubEnv('AUTH_URL', 'https://app.example.com')
    expect(getSiteUrl()).toBe('https://app.example.com')
  })

  it('falls back to NEXTAUTH_URL, then the production origin', () => {
    vi.stubEnv('AUTH_URL', '')
    vi.stubEnv('NEXTAUTH_URL', 'https://next.example.com')
    expect(getSiteUrl()).toBe('https://next.example.com')
    vi.stubEnv('NEXTAUTH_URL', '')
    expect(getSiteUrl()).toBe('https://eatforkful.com')
  })

  it('strips a trailing slash', () => {
    vi.stubEnv('AUTH_URL', 'https://app.example.com/')
    expect(getSiteUrl()).toBe('https://app.example.com')
  })
})

describe('absoluteUrl', () => {
  it('joins a path onto the site origin', () => {
    vi.stubEnv('AUTH_URL', 'https://app.example.com')
    expect(absoluteUrl('/blog/hello')).toBe('https://app.example.com/blog/hello')
  })

  it('leaves an already absolute URL alone', () => {
    expect(absoluteUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png')
  })

  it('exposes the default OG image path', () => {
    expect(DEFAULT_OG_IMAGE_PATH).toBe('/opengraph-image')
  })
})

describe('blogPostingJsonLd', () => {
  const post = { slug: 'hello', title: 'Hello', description: 'A post', date: '2026-06-10' }

  it('builds a BlogPosting with the required fields', () => {
    vi.stubEnv('AUTH_URL', 'https://app.example.com')
    expect(blogPostingJsonLd(post)).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: 'Hello',
      description: 'A post',
      datePublished: '2026-06-10',
      author: { '@type': 'Person', name: 'Steve' },
      url: 'https://app.example.com/blog/hello',
      image: 'https://app.example.com/opengraph-image',
    })
  })

  it('omits datePublished when the post has no date', () => {
    expect(blogPostingJsonLd({ ...post, date: '' })).not.toHaveProperty('datePublished')
  })

  it('uses the post ogImage when set', () => {
    expect(blogPostingJsonLd({ ...post, ogImage: 'https://cdn.example.com/x.png' }).image).toBe('https://cdn.example.com/x.png')
  })
})

describe('serializeJsonLd', () => {
  it('round-trips as JSON and cannot close the script tag', () => {
    const out = serializeJsonLd({ headline: '</script><script>alert(1)</script>' })
    expect(out).not.toContain('<')
    expect(JSON.parse(out)).toEqual({ headline: '</script><script>alert(1)</script>' })
  })
})
