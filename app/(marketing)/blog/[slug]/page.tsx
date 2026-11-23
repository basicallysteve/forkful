import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { getAllPosts, getPost } from '@/lib/mdx'
import { absoluteUrl, blogPostingJsonLd, DEFAULT_OG_IMAGE_PATH, serializeJsonLd } from '@/lib/seo'
import { formatPostDate } from '@/utils/formatPostDate'
import styles from './page.module.scss'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return getAllPosts().map(post => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return {}
  const image = absoluteUrl(post.ogImage ?? DEFAULT_OG_IMAGE_PATH)

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: absoluteUrl(`/blog/${slug}`) },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.description,
      url: absoluteUrl(`/blog/${slug}`),
      ...(post.date ? { publishedTime: post.date } : {}),
      images: [{ url: image }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [image],
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  return (
    <article className={styles.article}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(blogPostingJsonLd(post)) }}
      />
      <header className={styles.header}>
        <h1 className={styles.title}>{post.title}</h1>
        {post.date && (
          <time className={styles.date} dateTime={post.date}>
            {formatPostDate(post.date)}
          </time>
        )}
      </header>
      <div className={styles.body}>
        <MDXRemote source={post.content} />
      </div>
    </article>
  )
}
