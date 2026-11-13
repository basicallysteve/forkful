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

/** Throws UnauthorizedError on 401, otherwise a plain Error with `failureMessage` when not ok. */
export function assertWriteOk(res: Response, failureMessage: string, okStatuses: number[] = []): void {
  if (res.status === 401) throw new UnauthorizedError()
  if (!res.ok && !okStatuses.includes(res.status)) throw new Error(failureMessage)
}

export const SIGN_IN_REQUIRED_MESSAGE = 'Please sign in to make changes to foods.'
