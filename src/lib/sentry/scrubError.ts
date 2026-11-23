import type { ErrorEvent } from '@sentry/core'

const DB_PREFIX = 'Failed query:'
// Drizzle appends "\nparams: <bound values>" to the message of a failed query.
const PARAMS_SUFFIX = /\r?\nparams:[\s\S]*$/

/**
 * Removes the bound-parameter part of a Drizzle database error message. The SQL text and
 * the `Failed query:` prefix stay so Sentry still groups the issue. Other messages are
 * returned untouched.
 */
export function stripSqlParams(message: string): string {
  if (!message.startsWith(DB_PREFIX)) return message
  return message.replace(PARAMS_SUFFIX, '')
}

/** Non-personal context for a database error: the SQL operation and table name. */
export function describeDbError(message: string): { dbOperation?: string; dbTable?: string } {
  if (!message.startsWith(DB_PREFIX)) return {}
  const match = /^Failed query:\s*(insert into|update|delete from|select\b[\s\S]*?\bfrom)\s+"?([\w]+)"?/i.exec(message)
  if (!match) return {}
  const dbOperation = match[1].toLowerCase().split(/\s/)[0]
  return { dbOperation, dbTable: match[2] }
}

/**
 * `beforeSend` hook shared by every runtime: strips SQL params from the event message and
 * every exception value (including linked causes), so they cannot reach Sentry even if a
 * call site passes a raw error.
 */
export function scrubEvent<T extends ErrorEvent>(event: T): T {
  if (event.message) event.message = stripSqlParams(event.message)
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = stripSqlParams(exception.value)
  }
  return event
}
