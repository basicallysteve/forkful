import * as Sentry from '@sentry/nextjs'

/**
 * TaskRunner centralises all mutation operations (create / update / delete).
 * Every write operation flows through `taskRunner.run()` so that retry logic,
 * audit logging, or event emission can be added in one place later.
 *
 * Each run is wrapped in a Sentry span, so every write shows up in traces. Pass a
 * short, constant `name` (e.g. 'recipe.create') so spans group well; never put
 * ids or user data in the name.
 */
type TaskFn<T> = () => Promise<T>

export class TaskRunner {
  async run<T>(task: TaskFn<T>, name = 'task'): Promise<T> {
    return await Sentry.startSpan({ name, op: 'db.write' }, task)
  }
}

/** Singleton instance – import this everywhere instead of constructing a new one */
export const taskRunner = new TaskRunner()
