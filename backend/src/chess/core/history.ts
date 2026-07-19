import type { Move } from "./move";
import type { Position } from "./position";
import type { TurnContext } from "./state";
import { SideState } from "./state";

/* Snapshot to apply/undo moves or save in history */
export interface Snapshot {
  move: Move;
  previousSides: [SideState, SideState];
  previousEnPassantTarget: Position;
  previousHalfMoveClock: number;
  previousFullMoveNumber: number;
}

export const Snapshot = {
  /** Captures the pre-move state needed to undo the move later. */
  create(ctx: TurnContext, move: Move): Snapshot {
    return {
      move,
      previousSides: [SideState.copy(ctx.sides[0]), SideState.copy(ctx.sides[1])],
      previousEnPassantTarget: ctx.enPassantTarget,
      previousHalfMoveClock: ctx.halfMoveClock,
      previousFullMoveNumber: ctx.fullMoveNumber,
    };
  },
};
