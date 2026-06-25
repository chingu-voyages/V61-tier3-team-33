export interface ITracker {
  /** Increments the occurrence count for a position hash. */
  record(hash: bigint): void;

  /** Decrements the occurrence count for a position hash, with 0 as the floor. */
  undo(hash: bigint): void;

  /** Returns how many times the position hash has been recorded. */
  count(hash: bigint): number;
}
