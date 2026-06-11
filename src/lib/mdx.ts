import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const BLOG_DIR = path.join(process.cwd(), 'src/content/blog')

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
    .map(file => {
      const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8')
      const { data } = matter(raw)
      return {
        slug: file.replace(/\.mdx$/, ''),
        title: data.title ?? '',
        description: data.description ?? '',
        date: data.date ?? '',
        ogImage: data.ogImage,
      }
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function getPost(slug: string): Post | null {
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
