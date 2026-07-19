import type { TurnContext } from "../core/state"
import type { IEngine } from "../engine/engine"
import type { GameResult } from "../core/game"

export interface ITracker {
  record(hash: bigint): void
  undo(hash: bigint): void
  count(hash: bigint): number
}

export interface IRules {
  isFiftyMoveRule(ctx: TurnContext): boolean
  isThreefoldRepetition(tracker: ITracker, hash: bigint): boolean
  isInsufficientMaterial(ctx: TurnContext): boolean
  isCheckMate(ctx: TurnContext, engine: IEngine): boolean
  isStaleMate(ctx: TurnContext, engine: IEngine): boolean
  getGameResult(
    ctx: TurnContext,
    engine: IEngine,
    tracker: ITracker,
    hash: bigint
  ): GameResult
}
