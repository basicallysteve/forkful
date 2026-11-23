import type { ErrorEvent } from '@sentry/core'

const DB_MARKER = 'Failed query:'
// Drizzle appends "\nparams: <bound values>" to the message of a failed query.
const PARAMS_SUFFIX = /(Failed query:[\s\S]*?)\r?\nparams:[\s\S]*$/

/**
 * Removes the bound-parameter part of a Drizzle database error message, wherever the
 * `Failed query:` marker sits in the string. The SQL text and the marker stay so Sentry
 * still groups the issue. Other strings are returned untouched.
 */
export function stripSqlParams(message: string): string {
  if (!message.includes(DB_MARKER)) return message
  return message.replace(PARAMS_SUFFIX, (_all, head: string) => head)
}

/** Non-personal context for a database error: the SQL operation and table name. */
export function describeDbError(message: string): { dbOperation?: string; dbTable?: string } {
  if (!message.includes(DB_MARKER)) return {}
  const match = /Failed query:\s*(insert into|update|delete from|select\b[\s\S]*?\bfrom)\s+"?([\w]+)"?/i.exec(message)
  if (!match) return {}
  const dbOperation = match[1].toLowerCase().split(/\s/)[0]
  return { dbOperation, dbTable: match[2] }
}

function scrubValue(value: unknown): unknown {
  if (typeof value === 'string') return stripSqlParams(value)
  if (Array.isArray(value)) return value.map(scrubValue)
  return value
}

/**
 * `beforeSend` hook shared by every runtime: strips SQL params from the event message,
 * every exception value (including linked causes) and every breadcrumb (the console
 * integration records `console.error(err)` as one), so they cannot reach Sentry even if a
 * call site passes a raw error. Fails open: a bug here must never drop the event.
 */
export function scrubEvent<T extends ErrorEvent>(event: T): T {
  try {
    if (event.message) event.message = stripSqlParams(event.message)
    for (const exception of event.exception?.values ?? []) {
      if (exception.value) exception.value = stripSqlParams(exception.value)
    }
    for (const crumb of event.breadcrumbs ?? []) {
      if (crumb.message) crumb.message = stripSqlParams(crumb.message)
      if (crumb.data) {
        for (const key of Object.keys(crumb.data)) crumb.data[key] = scrubValue(crumb.data[key])
      }
    }
  } catch {
    // fall through with whatever was scrubbed so far
  }
  return event
}
