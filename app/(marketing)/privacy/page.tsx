import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { getLegalDocument } from '@/lib/legal'
import LegalPageView from '@/views/Legal/LegalPageView'

export async function generateMetadata(): Promise<Metadata> {
  const privacyPolicy = getLegalDocument('privacy')
  if (!privacyPolicy) return {}

  return {
    title: privacyPolicy.title,
    description: privacyPolicy.description,
    openGraph: {
      title: privacyPolicy.title,
      description: privacyPolicy.description,
      images: [{ url: '/og-default.png' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: privacyPolicy.title,
      description: privacyPolicy.description,
    },
  }
}

export default function PrivacyPage() {
  const privacyPolicy = getLegalDocument('privacy')
  if (!privacyPolicy) notFound()

  return (
    <LegalPageView title={privacyPolicy.title} effectiveDate={privacyPolicy.effectiveDate}>
      <MDXRemote source={privacyPolicy.content} />
    </LegalPageView>
  )
}
