import type { Snapshot } from "./history"
import type { Move } from "./move"
import type { Position } from "./position"
import type { TurnContext } from "./state"

import { SideState } from "./state"

export interface MoveHash {
  move: Move
  previousSides: [SideState, SideState]
  previousEnPassantTarget: Position
  newSides: [SideState, SideState]
}

export const MoveHash = {
  create(snapshot: Snapshot, ctx: TurnContext): MoveHash {
    return {
      move: snapshot.move,
      previousSides: snapshot.previousSides,
      previousEnPassantTarget: snapshot.previousEnPassantTarget,
      newSides: [SideState.copy(ctx.sides[0]), SideState.copy(ctx.sides[1])],
    }
  },
}
