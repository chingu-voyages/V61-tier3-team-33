import type { ITracker } from "./tracker";

export class PositionTracker implements ITracker {
  private readonly counter = new Map<bigint, number>();

  record(hash: bigint): void {
    this.counter.set(hash, this.count(hash) + 1);
  }

  undo(hash: bigint): void {
    const count = this.count(hash);
    if (count <= 1) {
      this.counter.delete(hash);
      return;
    }
    this.counter.set(hash, count - 1);
  }

  count(hash: bigint): number {
    return this.counter.get(hash) ?? 0;
  }
}
