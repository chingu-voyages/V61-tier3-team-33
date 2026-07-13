import type { Brand } from "../../chess/core/brand";

export type Priority = Brand<number, "Priority">;
export const Priority = Object.assign(
  (value: number): Priority => value as Priority,
  {
    label: (p: Priority): "FAST" | "DEFERRED" => (p === 0 ? "FAST" : "DEFERRED"),
  },
);
export const FAST: Priority = Priority(0);
export const DEFERRED: Priority = Priority(1);
