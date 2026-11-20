import * as Sentry from '@sentry/nextjs'

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

export function captureError(error: unknown, { area, attributes }: CaptureErrorOptions) {
  Sentry.captureException(error, {
    tags: { area },
    ...(attributes ? { extra: attributes } : {}),
  })
  Sentry.logger.error(error instanceof Error ? error.message : String(error), {
    area,
    ...attributes,
    errorName: error instanceof Error ? error.name : 'NonError',
  })
}
