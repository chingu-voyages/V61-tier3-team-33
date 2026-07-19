// Called when it's this waiter's turn to acquire the lock.
type Waiter = () => void;

// Serializes async work so only one run() body executes at a time.
export class Mutex {
  private locked = false;
  private queue: Waiter[] = [];

  // Run fn exclusively; waits its turn, releases even if fn throws.
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.lock();
    try {
      return await fn();
    } finally {
      this.unlock();
    }
  }

  // Grab the lock now if free, otherwise queue and wait for unlock() to hand it over.
  private lock(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.locked = true;
        resolve();
      });
    });
  }

  // Free the lock and pass it straight to the longest-waiting caller, if any.
  private unlock(): void {
    this.locked = false;
    this.queue.shift()?.();
  }
}
