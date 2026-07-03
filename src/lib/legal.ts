import 'server-only'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const LEGAL_DIR = path.join(process.cwd(), 'src/content/legal')

const SAFE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isSafeSlug(slug: string): boolean {
  return SAFE_SLUG_RE.test(slug)
}

export interface LegalDocument {
  slug: string
  title: string
  description: string
  effectiveDate?: string
  content: string
}

export function getLegalDocument(slug: string): LegalDocument | null {
  if (!isSafeSlug(slug)) return null

  const markdownPath = path.join(LEGAL_DIR, `${slug}.md`)
  const mdxPath = path.join(LEGAL_DIR, `${slug}.mdx`)

  const filePath = fs.existsSync(markdownPath)
    ? markdownPath
    : fs.existsSync(mdxPath)
      ? mdxPath
      : null

  if (!filePath) return null

  const raw = fs.readFileSync(filePath, 'utf8')
  const { data, content } = matter(raw)

  const effectiveDate = (() => {
    if (!data.effectiveDate) return undefined
    if (data.effectiveDate instanceof Date) {
      return data.effectiveDate.toISOString().slice(0, 10)
    }
    return String(data.effectiveDate)
  })()

  return {
    slug,
    title: data.title ?? '',
    description: data.description ?? '',
    effectiveDate,
    content,
  }
}
