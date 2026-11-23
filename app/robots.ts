import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/seo'

/**
 * Public and marketing pages, and public Recipe pages (/recipes, /recipes/<id>/<slug>), stay crawlable
 * (ADR-0032, Crawler Exemption). Only the API, admin and signed-in or auth screens are blocked.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin',
        '/pantry',
        '/profile',
        '/shopping-list',
        '/log',
        '/foods',
        '/recipes/new',
        '/welcome',
        '/waitlist',
        '/login',
        '/logout',
        '/create-account',
        '/forgot-password',
        '/reset-password',
      ],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
