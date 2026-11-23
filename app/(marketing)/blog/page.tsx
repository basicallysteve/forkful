import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllPosts } from '@/lib/mdx'
import { formatPostDate } from '@/utils/formatPostDate'
import styles from './page.module.scss'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Updates, ideas, and notes from the EatForkful kitchen.',
  openGraph: {
    title: 'EatForkful Blog',
    description: 'Updates, ideas, and notes from the EatForkful kitchen.',
    images: [{ url: '/og-default.png' }],
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
                    {formatPostDate(post.date)}
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
