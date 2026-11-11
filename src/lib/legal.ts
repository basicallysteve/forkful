import 'server-only'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const LEGAL_DIR = path.join(process.cwd(), 'src/content/legal')

const SAFE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isSafeSlug(slug: string): boolean {
  return SAFE_SLUG_RE.test(slug)
}

function readLegalFile(slug: string) {
  if (!isSafeSlug(slug)) return null

  const markdownPath = path.join(LEGAL_DIR, `${slug}.md`)
  const mdxPath = path.join(LEGAL_DIR, `${slug}.mdx`)

  const filePath = fs.existsSync(markdownPath)
    ? markdownPath
    : fs.existsSync(mdxPath)
      ? mdxPath
      : null

  if (!filePath) return null

  // Defence in depth: ensure the resolved path never escapes LEGAL_DIR.
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(path.resolve(LEGAL_DIR) + path.sep)) return null

  const raw = fs.readFileSync(resolved, 'utf8')
  return matter(raw)
}

function normalizeEffectiveDate(value: unknown): string | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}

export interface LegalDocument {
  slug: string
  title: string
  description: string
  effectiveDate?: string
  content: string
}

export function getLegalDocument(slug: string): LegalDocument | null {
  const parsed = readLegalFile(slug)
  if (!parsed) return null

  const { data, content } = parsed

  return {
    slug,
    title: data.title ?? '',
    description: data.description ?? '',
    effectiveDate: normalizeEffectiveDate(data.effectiveDate),
    content,
  }
}

export interface LegalPage {
  slug: string
  title: string
  description: string
  effectiveDate: string
  content: string
}

// Alias retained for the terms page (introduced on main); coerces the optional
// effectiveDate to a required string to preserve that caller's contract.
export function getLegalPage(slug: string): LegalPage | null {
  const doc = getLegalDocument(slug)
  if (!doc) return null

  return { ...doc, effectiveDate: doc.effectiveDate ?? '' }
}
