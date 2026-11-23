import type { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/mdx'
import { absoluteUrl } from '@/lib/seo'

/** Marketing pages only. Signed-in app screens and public Recipe pages are deliberately not listed. */
const MARKETING_PATHS = ['/', '/about', '/blog', '/privacy', '/terms']

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts().map(post => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    ...(post.date ? { lastModified: new Date(post.date) } : {}),
  }))

  return [...MARKETING_PATHS.map(path => ({ url: absoluteUrl(path) })), ...posts]
}
