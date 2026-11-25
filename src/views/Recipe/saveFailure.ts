import { ApiError, errorMessageFor } from '@/lib/api/errors'

export const SAVE_FAILURE_TITLE = 'Could not save recipe'
/** How long the save-error toast stays on screen before it dismisses itself. */
export const SAVE_FAILURE_LIFE_MS = 4000

/** Toast text for a failed recipe create, chosen by what went wrong. Never the raw error message, except the server's own message for a 400. */
export function recipeSaveFailureMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.kind) {
      case 'network':
        return 'Check your connection and try again.'
      case 'unauthorized':
        return 'Your session expired. Sign in again to save this recipe.'
      case 'forbidden':
        return "You don't have permission to save this recipe."
      case 'server':
        return 'Something went wrong on our side. Try again in a moment.'
    }
  }
  return errorMessageFor(err, 'save this recipe')
}
