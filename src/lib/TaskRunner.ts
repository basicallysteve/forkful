/**
 * TaskRunner centralises all mutation operations (create / update / delete).
 * Every write operation flows through `taskRunner.run()` so that retry logic,
 * audit logging, or event emission can be added in one place later.
 */
type TaskFn<T> = () => Promise<T>

export class TaskRunner {
  async run<T>(task: TaskFn<T>): Promise<T> {
    return await task()
  }
}

/** Singleton instance – import this everywhere instead of constructing a new one */
export const taskRunner = new TaskRunner()
