import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  // Lets the Sentry browser profiler (instrumentation-client.ts) run. Without this
  // header browsers silently refuse to start the JS Self-Profiling API.
  async headers() {
    return [{ source: '/(.*)', headers: [{ key: 'Document-Policy', value: 'js-profiling' }] }]
  },
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Strips Sentry SDK debug logging from webpack bundles only. Turbopack (the default for
  // `next dev` and `next build` in Next 16) ignores it, so no-op there. Sentry Logs are unaffected.
  webpack: { treeshake: { removeDebugLogging: true } },
})
