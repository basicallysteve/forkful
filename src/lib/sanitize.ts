import sanitizeHtml from 'sanitize-html'

const QUILL_ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's',
  'h1', 'h2', 'h3',
  'ol', 'ul', 'li',
  'blockquote', 'pre', 'code',
  'a', 'img',
]

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: QUILL_ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
    },
    allowedSchemes: ['https', 'http'],
    allowedSchemesByTag: {
      img: ['https'],
    },
  })
}
