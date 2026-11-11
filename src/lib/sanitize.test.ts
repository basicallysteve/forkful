import { describe, expect, it } from 'vitest'

import { sanitizeRichText } from '@/lib/sanitize'

describe('sanitizeRichText', () => {
  it('removes disallowed tags', () => {
    const result = sanitizeRichText('<p>Hello</p><script>alert(1)</script>')

    expect(result).toContain('<p>Hello</p>')
    expect(result).not.toContain('<script>')
  })

  it('keeps vercel blob https images', () => {
    const src = 'https://abc.public.blob.vercel-storage.com/image.png'

    const result = sanitizeRichText(`<p>Image</p><img src="${src}" alt="ok" />`)

    expect(result).toContain(`<img src="${src}" alt="ok" />`)
  })

  it('removes non-blob images', () => {
    const result = sanitizeRichText('<img src="https://example.com/image.png" alt="nope" />')

    expect(result).not.toContain('<img')
  })
})
