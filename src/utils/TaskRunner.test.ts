import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskRunner } from './TaskRunner';
import { db } from '@/db/index';

// Mock the database and its transaction method
vi.mock('@/db/index', () => ({
  db: {
    _isMockDb: true,
    transaction: vi.fn(async (cb) => {
      // Provide a mock transaction object
      const mockTx = { _isMockTx: true };
      return cb(mockTx);
    }),
  },
}));

describe('TaskRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run a single task and return the payload', async () => {
    const runner = new TaskRunner<{ count: number }>();
    
    runner.add(async (payload) => {
      return { count: payload.count + 1 };
    });

    const result = await runner.run({ count: 0 });
    expect(result.count).toBe(1);
  });

  it('should chain multiple tasks and pass the payload forward sequentially', async () => {
    const runner = new TaskRunner<number>();
    
    runner.add((payload) => payload + 5)
          .add((payload) => payload * 2)
          .add((payload) => payload - 3);

    const result = await runner.run(10);
    
    // Expected: (10 + 5) * 2 - 3 = 27
    expect(result).toBe(27);
  });

  it('should wrap tasks in a database transaction by default', async () => {
    const runner = new TaskRunner<string>();
    
    runner.add((payload, tx: any) => {
      // Verify that the mock transaction object was passed instead of the db
      expect(tx).toHaveProperty('_isMockTx', true);
      return payload + ' processed';
    });

    const result = await runner.run('test');
    expect(result).toBe('test processed');
    expect(db.transaction).toHaveBeenCalledOnce();
  });

  it('should run without transaction if transactional is false', async () => {
    const runner = new TaskRunner<number>({ transactional: false });
    
    runner.add((payload, tx: any) => {
      // Verify that the main db object was passed
      expect(tx).toHaveProperty('_isMockDb', true);
      return payload + 1;
    });

    const result = await runner.run(0);
    expect(result).toBe(1);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('should propagate errors and reject the promise', async () => {
    const runner = new TaskRunner<any>();
    
    runner.add(() => { throw new Error('Task Failed'); });
    runner.add(() => { return 'should not reach here'; });

    await expect(runner.run({})).rejects.toThrow('Task Failed');
  });
});