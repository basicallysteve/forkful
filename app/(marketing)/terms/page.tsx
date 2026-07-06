import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { getLegalPage } from '@/lib/legal'
import LegalPageView from '@/views/Legal/LegalPageView'

export async function generateMetadata(): Promise<Metadata> {
  const page = getLegalPage('terms')
  if (!page) return {}
  return {
    title: page.title,
    description: page.description,
  }
}

export default async function TermsPage() {
  const page = getLegalPage('terms')
  if (!page) notFound()

  return (
    <LegalPageView title={page.title} effectiveDate={page.effectiveDate}>
      <MDXRemote source={page.content} />
    </LegalPageView>
  )
}
