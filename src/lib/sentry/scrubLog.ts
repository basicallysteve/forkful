import type { Log } from '@sentry/core'

const SENSITIVE_KEY = /pass(word)?|token|secret|email|authorization|cookie|api[-_]?key/i

/**
 * `beforeSendLog` hook shared by every runtime. Two jobs:
 *  1. Drop trace/debug logs so chatty diagnostics never consume Sentry quota.
 *  2. Redact attributes whose key looks sensitive. Log attributes are the one place
 *     developers put arbitrary context, so this is the safety net against leaking PII.
 * Return `null` to drop a log.
 */
export function scrubLog(log: Log): Log | null {
  if (log.level === 'trace' || log.level === 'debug') return null
  if (!log.attributes) return log

  const attributes = Object.fromEntries(
    Object.entries(log.attributes).map(([key, value]) => [
      key,
      SENSITIVE_KEY.test(key) ? '[redacted]' : value,
    ]),
  )
  return { ...log, attributes }
}
