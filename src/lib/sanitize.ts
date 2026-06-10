import sanitizeHtml from 'sanitize-html'

const QUILL_ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's',
  'h1', 'h2', 'h3',
  'ol', 'ul', 'li',
  'blockquote', 'pre', 'code',
  'img',
]

// Only images hosted on Vercel Blob are allowed — external image URLs are stripped.
const BLOB_IMG_SRC = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: QUILL_ALLOWED_TAGS,
    allowedAttributes: {
      img: ['src', 'alt', 'width', 'height'],
    },
    allowedSchemes: ['https'],
    allowedSchemesByTag: {
      img: ['https'],
    },
    exclusiveFilter: (frame) => {
      if (frame.tag === 'img') {
        return !BLOB_IMG_SRC.test(frame.attribs.src ?? '')
      }
      return false
    },
  })
}
