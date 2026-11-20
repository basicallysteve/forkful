import { describe, it, expect } from 'vitest'
import { TaskRunner, taskRunner } from './TaskRunner'

describe('TaskRunner', () => {
  it('runs a task and returns its result', async () => {
    const runner = new TaskRunner()
    const result = await runner.run(async () => 42)
    expect(result).toBe(42)
  })

  it('propagates errors from the task', async () => {
    const runner = new TaskRunner()
    await expect(
      runner.run(async () => { throw new Error('Task failed') })
    ).rejects.toThrow('Task failed')
  })

  it('accepts an optional span name without changing the result', async () => {
    const runner = new TaskRunner()
    expect(await runner.run(async () => 'ok', 'recipe.create')).toBe('ok')
  })

  it('taskRunner singleton is a TaskRunner instance', () => {
    expect(taskRunner).toBeInstanceOf(TaskRunner)
  })

  it('runs multiple tasks sequentially', async () => {
    const runner = new TaskRunner()
    const results = await Promise.all([
      runner.run(async () => 1),
      runner.run(async () => 2),
      runner.run(async () => 3),
    ])
    expect(results).toEqual([1, 2, 3])
  })
})
