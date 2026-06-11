import 'server-only'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const BLOG_DIR = path.join(process.cwd(), 'src/content/blog')

/** Only allow slugs that are safe to embed in a URL path: lowercase letters, digits, hyphens. */
const SAFE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isSafeSlug(slug: string): boolean {
  return SAFE_SLUG_RE.test(slug)
}

export interface PostMeta {
  slug: string
  title: string
  description: string
  date: string
  ogImage?: string
}

export interface Post extends PostMeta {
  content: string
}

export function getAllPosts(): PostMeta[] {
  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.mdx'))
  return files
    .flatMap(file => {
      const slug = file.replace(/\.mdx$/, '')
      if (!isSafeSlug(slug)) return []
      const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8')
      const { data } = matter(raw)
      return [{
        slug,
        title: data.title ?? '',
        description: data.description ?? '',
        date: data.date ?? '',
        ogImage: data.ogImage,
      }]
    })
    .sort((a, b) => {
      if (a.date < b.date) return 1
      if (a.date > b.date) return -1
      return 0
    })
}

export function getPost(slug: string): Post | null {
  if (!isSafeSlug(slug)) return null
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`)
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf8')
  const { data, content } = matter(raw)
  return {
    slug,
    title: data.title ?? '',
    description: data.description ?? '',
    date: data.date ?? '',
    ogImage: data.ogImage,
    content,
  }
}
