import * as Sentry from '@sentry/nextjs'
import { scrubLog } from '@/lib/sentry/scrubLog'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  // Sample a slice of server traces; 100% is rarely affordable on the server.
  tracesSampleRate: 0.1,
  // Structured logs via Sentry.logger (see src/lib/logger.ts).
  enableLogs: true,
  beforeSendLog: scrubLog,
  // Never attach IPs, cookies or headers automatically.
  sendDefaultPii: false,
})
