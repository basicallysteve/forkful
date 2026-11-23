import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllPosts } from '@/lib/mdx'
import { absoluteUrl, DEFAULT_OG_IMAGE_PATH } from '@/lib/seo'
import styles from './page.module.scss'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Updates, ideas, and notes from the EatForkful kitchen.',
  alternates: { canonical: absoluteUrl('/blog') },
  openGraph: {
    title: 'EatForkful Blog',
    description: 'Updates, ideas, and notes from the EatForkful kitchen.',
    url: absoluteUrl('/blog'),
    images: [{ url: absoluteUrl(DEFAULT_OG_IMAGE_PATH) }],
  },
}

export default function BlogIndexPage() {
  const posts = getAllPosts()

  return (
    <div>
      <h1 className={styles.heading}>Blog</h1>
      {posts.length === 0 ? (
        <p className={styles.empty}>No posts yet.</p>
      ) : (
        <ul className={styles.list}>
          {posts.map(post => (
            <li key={post.slug} className={styles.item}>
              <Link href={`/blog/${post.slug}`} className={styles.postLink}>
                <span className={styles.postTitle}>{post.title}</span>
                {post.date && (
                  <time className={styles.postDate} dateTime={post.date}>
                    {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </time>
                )}
                {post.description && (
                  <span className={styles.postDescription}>{post.description}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
