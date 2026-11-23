import * as Sentry from '@sentry/nextjs'
import { describeDbError, stripSqlParams } from '@/lib/sentry/scrubError'

/**
 * Thin wrapper over Sentry's structured logger so call sites share one convention:
 *  - a short, constant message (groups well and is searchable),
 *  - variable data in `attributes` (filterable fields), never string-concatenated,
 *  - no PII in either (see scrubLog.ts for the safety net).
 *
 * Use logInfo/logWarn for notable events. For failures use captureError, which both
 * raises an issue (with a stack trace) and leaves a searchable log line.
 */
export type LogAttributes = Record<string, string | number | boolean | null | undefined>

export function logInfo(message: string, attributes?: LogAttributes) {
  Sentry.logger.info(message, attributes)
}

export function logWarn(message: string, attributes?: LogAttributes) {
  Sentry.logger.warn(message, attributes)
}

interface CaptureErrorOptions {
  /** Feature area, becomes a Sentry tag, e.g. 'food-log', 'usda', 'auth'. Keep the set small. */
  area: string
  /** Extra context for debugging. IDs and counts, not personal data. */
  attributes?: LogAttributes
}

/** Copy of a database error whose message (and stack header) has no bound params. */
function withoutSqlParams(error: Error): Error {
  const message = stripSqlParams(error.message)
  if (message === error.message) return error
  const clean = new Error(message, { cause: error.cause })
  clean.name = error.name
  clean.stack = error.stack?.replace(error.message, () => message)
  return clean
}

export function captureError(error: unknown, { area, attributes }: CaptureErrorOptions) {
  const safe = error instanceof Error ? withoutSqlParams(error) : error
  const message = safe instanceof Error ? safe.message : String(safe)
  Sentry.captureException(safe, {
    tags: { area },
    ...(attributes ? { extra: attributes } : {}),
  })
  Sentry.logger.error(message, {
    area,
    ...describeDbError(message),
    ...attributes,
    errorName: safe instanceof Error ? safe.name : 'NonError',
  })
}
