import sanitizeHtml from 'sanitize-html'

const QUILL_ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's',
  'h1', 'h2', 'h3',
  'ol', 'ul', 'li',
  'blockquote', 'pre', 'code',
  'img',
]

// Only images hosted on Vercel Blob are allowed — external image URLs are stripped.
// Hostname is parsed via URL so subdomain-confusion attacks (e.g. vercel-storage.com.evil.com) can't match.
function isBlobUrl(src: string): boolean {
  try {
    const { protocol, hostname } = new URL(src)
    return protocol === 'https:' && hostname.endsWith('.public.blob.vercel-storage.com')
  } catch {
    return false
  }
}

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
        return !isBlobUrl(frame.attribs.src ?? '')
      }
      return false
    },
  })
}
