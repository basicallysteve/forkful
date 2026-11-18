/** Thrown by client API wrappers when the server answers 401 (no signed-in user). */
export class UnauthorizedError extends Error {
  constructor(message = 'Sign in required') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export function isUnauthorizedError(err: unknown): err is UnauthorizedError {
  return err instanceof UnauthorizedError
}

/** Thrown by client API wrappers when the server answers 403 (signed in, not allowed). */
export class ForbiddenError extends Error {
  constructor(message = 'Not allowed') {
    super(message)
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
