export interface ITracker {
  record(hash: bigint): void;
  undo(hash: bigint): void;
  count(hash: bigint): number;
}