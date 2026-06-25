import type { Snapshot } from "../core/history";
import type { IHistory } from "./history";

/** MemoryHistory is the default in-memory IHistory implementation. */
export class MemoryHistory implements IHistory {
  private readonly entries: Snapshot[] = [];

  push(entry: Snapshot): void {
    this.entries.push(entry);
  }

  pop(): Snapshot | null {
    return this.entries.pop() ?? null;
  }

  peek(): Snapshot | null {
    return this.entries[this.entries.length - 1] ?? null;
  }

  len(): number {
    return this.entries.length;
  }

  all(): Snapshot[] {
    return [...this.entries];
  }
}
