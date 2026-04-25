import { db } from '@/db/index';

export type Task<T, Tx = any> = (payload: T, tx: Tx) => Promise<T> | T;

export class TaskRunner<T, Tx = any> {
  private tasks: Task<T, Tx>[] = [];
  private transactional: boolean;

  constructor(options: { transactional?: boolean } = {}) {
    this.transactional = options.transactional ?? true;
  }

  add(task: Task<T, Tx>) {
    this.tasks.push(task);
    return this;
  }

  async run(initialPayload: T): Promise<T> {
    if (!this.transactional) {
      for (const task of this.tasks) {
        initialPayload = await task(initialPayload, db);
      }
      return initialPayload;
    }

    return await db.transaction(async (tx) => {
      let payload = initialPayload;
      for (const task of this.tasks) {
        payload = await task(payload, tx as Tx);
      }
      return payload;
    });
  }
}