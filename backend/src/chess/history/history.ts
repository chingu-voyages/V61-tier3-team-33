import type { Snapshot } from "../core/history";

/** IHistory is a LIFO stack of snapshots — the undo history of a game. */
export interface IHistory {
  /** Appends a snapshot to the top of the stack. */
  push(entry: Snapshot): void;

  /** Removes and returns the top snapshot, or null if the stack is empty. */
  pop(): Snapshot | null;

  /** Returns the top snapshot without removing it, or null if the stack is empty. */
  peek(): Snapshot | null;

  /** Returns the number of snapshots in the stack. */
  len(): number;

  /** Returns a copy of all snapshots in push order (oldest first). */
  all(): Snapshot[];
}
