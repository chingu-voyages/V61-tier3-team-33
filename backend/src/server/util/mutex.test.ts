import { describe, expect, it } from "bun:test";
import { Mutex } from "./mutex";

describe("Mutex", () => {
  it("runs a single task and returns its result", async () => {
    const mutex = new Mutex();
    const result = await mutex.run(async () => 42);
    expect(result).toBe(42);
  });

  it("propagates the error thrown by fn", async () => {
    const mutex = new Mutex();
    const boom = new Error("task failed");

    const promise = mutex.run(async () => {
      throw boom;
    });

    await expect(promise).rejects.toThrow(boom);
  });

  it("never overlaps two concurrent run() calls", async () => {
    const mutex = new Mutex();
    let active = 0;
    let maxActive = 0;

    async function task() {
      active++;
      maxActive = Math.max(maxActive, active);
      await Bun.sleep(5);
      active--;
    }

    await Promise.all([mutex.run(task), mutex.run(task), mutex.run(task)]);

    expect(maxActive).toBe(1);
  });

  it("runs queued tasks in the order they were submitted (FIFO)", async () => {
    const mutex = new Mutex();
    const order: number[] = [];

    function task(id: number) {
      return mutex.run(async () => {
        order.push(id);
        await Bun.sleep(1);
      });
    }

    await Promise.all([task(1), task(2), task(3)]);

    expect(order).toEqual([1, 2, 3]);
  });

  it("releases the lock even when fn throws, so later tasks still run", async () => {
    const mutex = new Mutex();
    const order: string[] = [];

    const failing = mutex.run(async () => {
      order.push("first");
      throw new Error("boom");
    });

    const succeeding = mutex.run(async () => {
      order.push("second");
    });

    const results = await Promise.allSettled([failing, succeeding]);

    // "first" always runs before "second" — the queue is still FIFO.
    expect(order).toEqual(["first", "second"]);
    expect(results[0].status).toBe("rejected");
    expect(results[1].status).toBe("fulfilled");
  });

  it("does not block a run() call after the mutex is fully drained", async () => {
    const mutex = new Mutex();

    await mutex.run(async () => "one");
    const result = await mutex.run(async () => "two");

    expect(result).toBe("two");
  });

  it("handles many sequential run() calls without leaking queued waiters", async () => {
    const mutex = new Mutex();
    const order: number[] = [];

    const tasks = Array.from({ length: 20 }, (_, i) =>
      mutex.run(async () => {
        order.push(i);
      }),
    );

    await Promise.all(tasks);

    expect(order).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it("keeps exclusivity across a mix of sync-throwing and async tasks", async () => {
    const mutex = new Mutex();
    let active = 0;
    let sawOverlap = false;

    async function guarded(fn: () => Promise<void>) {
      return mutex.run(async () => {
        active++;
        if (active > 1) sawOverlap = true;
        try {
          await fn();
        } finally {
          active--;
        }
      });
    }

    const results = await Promise.allSettled([
      guarded(async () => {
        throw new Error("fails immediately");
      }),
      guarded(async () => Bun.sleep(3)),
      guarded(async () => {
        /* no-op */
      }),
    ]);

    expect(sawOverlap).toBe(false);
    expect(results[0].status).toBe("rejected");
    expect(results[1].status).toBe("fulfilled");
    expect(results[2].status).toBe("fulfilled");
  });
});
