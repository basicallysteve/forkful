import 'server-only'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const LEGAL_DIR = path.join(process.cwd(), 'src/content/legal')

export interface LegalPage {
  slug: string
  title: string
  description: string
  effectiveDate: string
  content: string
}

export function getLegalPage(slug: string): LegalPage | null {
  if (!/^[a-z0-9-]+$/i.test(slug)) return null

  const filePath = path.join(LEGAL_DIR, `${slug}.md`)
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(path.resolve(LEGAL_DIR) + path.sep)) return null
  if (!fs.existsSync(resolved)) return null

  const raw = fs.readFileSync(resolved, 'utf8')
  const { data, content } = matter(raw)
  return {
    slug,
    title: data.title ?? '',
    description: data.description ?? '',
    effectiveDate: data.effectiveDate ? String(data.effectiveDate) : '',
    content,
  }
}
