import type { TurnContext } from "../core/state";
import type { MoveHash } from "../core/hash";

export interface IHasher {
  initHash(ctx: TurnContext): bigint;
  hash(current: bigint, move: MoveHash): bigint;
}