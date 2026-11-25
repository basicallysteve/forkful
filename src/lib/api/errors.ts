export type ApiErrorKind = 'unauthorized' | 'forbidden' | 'not_found' | 'invalid' | 'server' | 'network'

/** A failed API call: the HTTP status (0 for network failures), what kind of failure it was, and a message. */
export class ApiError extends Error {
  readonly status: number
  readonly kind: ApiErrorKind
  constructor({ status, kind, message }: { status: number; kind: ApiErrorKind; message: string }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.kind = kind
  }
}

/** Thrown by client API wrappers when the server answers 401 (no signed-in user). */
export class UnauthorizedError extends ApiError {
  constructor(message = 'Sign in required') {
    super({ status: 401, kind: 'unauthorized', message })
    this.name = 'UnauthorizedError'
  }
}

export function isUnauthorizedError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.kind === 'unauthorized'
}

/** Thrown by client API wrappers when the server answers 403 (signed in, not allowed). */
export class ForbiddenError extends ApiError {
  constructor(message = 'Not allowed') {
    super({ status: 403, kind: 'forbidden', message })
    this.name = 'ForbiddenError'
  }
}

/** An Error that remembers the HTTP status that caused it. */
export class HttpError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

/** Throws UnauthorizedError on 401, ForbiddenError on 403, otherwise an HttpError with `failureMessage` when not ok. */
export function assertWriteOk(res: Response, failureMessage: string, okStatuses: number[] = []): void {
  if (res.status === 401) throw new UnauthorizedError()
  if (res.status === 403) throw new ForbiddenError()
  if (!res.ok && !okStatuses.includes(res.status)) throw new HttpError(failureMessage, res.status)
}

/** User-facing explanation for a failed save, chosen by what actually went wrong. */
export function describeSaveFailure(err: unknown): string {
  if (err instanceof UnauthorizedError) return 'Please sign in again to save your changes.'
  if (err instanceof ForbiddenError) return 'You do not have permission to change this.'
  const status = (err as { status?: unknown } | null)?.status
  if (status === 404) return 'This item no longer exists. Refresh the page and try again.'
  return 'Could not save. Check your connection and try again.'
}

export const SIGN_IN_REQUIRED_MESSAGE = 'Please sign in to make changes to foods.'

/** fetch that reports a network failure (offline, DNS, CORS) as an ApiError of kind `network`. */
export async function apiFetch(...args: Parameters<typeof fetch>): Promise<Response> {
  try {
    return await fetch(...args)
  } catch (err) {
    if (err instanceof TypeError) throw networkError(err.message)
    throw err
  }
}

function networkError(message: string): ApiError {
  return new ApiError({ status: 0, kind: 'network', message })
}

function kindForStatus(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  return status >= 500 ? 'server' : 'invalid'
}

async function serverMessage(res: Response): Promise<string | null> {
  try {
    const body = await res.json()
    return typeof body?.error === 'string' && body.error ? body.error : null
  } catch {
    return null
  }
}

/** Resolves when the response is ok (or its status is in `okStatuses`); otherwise throws an ApiError built from the status and the server's `{error}` message, else `fallback`. */
export async function ensureOk(res: Response, fallback: string, okStatuses: number[] = []): Promise<void> {
  if (res.ok || okStatuses.includes(res.status)) return
  const fromServer = await serverMessage(res)
  if (res.status === 401) throw new UnauthorizedError(fromServer ?? fallback)
  if (res.status === 403) throw new ForbiddenError(fromServer ?? fallback)
  throw new ApiError({ status: res.status, kind: kindForStatus(res.status), message: fromServer ?? fallback })
}

/** Toast text for a failed action such as "save this recipe", chosen by what went wrong. */
export function errorMessageFor(err: unknown, action: string): string {
  const apiErr = err instanceof ApiError ? err : err instanceof TypeError ? networkError(err.message) : null
  switch (apiErr?.kind) {
    case 'unauthorized':
      return `Please sign in to ${action}.`
    case 'forbidden':
      return `You do not have permission to ${action}.`
    case 'not_found':
      return 'This item no longer exists. Refresh the page and try again.'
    case 'invalid':
      return apiErr.message
    case 'server':
      return `Could not ${action} because something went wrong on our side. Please try again in a moment.`
    case 'network':
      return `Could not ${action}. Check your connection and try again.`
    default:
      return `Could not ${action}. Please try again.`
  }
}
