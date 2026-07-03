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
  const filePath = path.join(LEGAL_DIR, `${slug}.md`)
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf8')
  const { data, content } = matter(raw)
  return {
    slug,
    title: data.title ?? '',
    description: data.description ?? '',
    effectiveDate: data.effectiveDate ? String(data.effectiveDate) : '',
    content,
  }
}
