import { execSync } from 'child_process'

// Only run DB migrations on Vercel Production deployments.
// Preview deployments don't have DB credentials and test against an
// already-migrated database, so the migration step is skipped there.
if (process.env.VERCEL_ENV === 'production') {
  execSync('drizzle-kit migrate', { stdio: 'inherit' })
}
