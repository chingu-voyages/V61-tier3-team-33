import type { Move } from "./core/move"
import type { Position } from "./core/position"
import type { Snapshot } from "./core/history"
import type { TurnContext } from "./core/state"
import type { GameResult } from "./core/game"

import { Board, Square } from "./core/board"
import { WHITE, BLACK, PieceColor } from "./core/piece"
import { MoveContext, TurnContext as TC } from "./core/state"
import { getDefaultEngine, DefaultEngine } from "./engine/default"
import { FEN } from "./fen"
import { getDefaultRules, DefaultRules } from "./rules/default"
import type { ITracker } from "./rules/rules"
import { PositionTracker } from "./tracker/position"
import { getDefaultHasher } from "./hasher"
import type { IHasher } from "./hasher"
import { MoveHash } from "./core/hash"

export type { Move } from "./core/move"
export type { Snapshot } from "./core/history"
export type { TurnContext } from "./core/state"
export { Position, NO_POSITION } from "./core/position"
export {
  PieceColor,
  PieceType,
  WHITE,
  BLACK,
  PAWN,
  KNIGHT,
  BISHOP,
  ROOK,
  QUEEN,
  KING,
} from "./core/piece"
export type { GameResult } from "./core/game"
export {
  GameStatus,
  IN_PROGRESS,
  CHECKMATE,
  DRAW,
  STALEMATE,
} from "./core/game"

export class Chess {
  private ctx: TurnContext
  private engine: DefaultEngine
  private rules: DefaultRules
  private tracker: ITracker
  private hasher: IHasher
  private currentHash: bigint

  constructor(fen?: string) {
    this.ctx = TC.create()
    this.engine = getDefaultEngine()
    this.rules = getDefaultRules() as DefaultRules
    this.tracker = new PositionTracker()
    this.hasher = getDefaultHasher()
    this.currentHash = BigInt(0)
    if (fen) {
      this.load(fen)
    }
  }

  load(fen: string): void {
    this.ctx = FEN.decode(fen)
    this.currentHash = this.hasher.initHash(this.ctx)
    this.tracker.record(this.currentHash)
  }

  fen(): string {
    return FEN.encode(this.ctx)
  }

  turn(): PieceColor {
    return this.ctx.sideToMove
  }

  board(): Board {
    return this.ctx.board
  }

  at(position: Position): Square {
    return Board.at(this.ctx.board, position)
  }

  legalMoves(from: Position): Move[] {
    return this.engine.getLegalMoves([], from, this.ctx)
  }

  legalMovesMap(): Map<Position, Position[]> {
    const all = this.engine.getAllLegalMoves([], this.ctx)
    const map = new Map<Position, Position[]>()
    for (const move of all) {
      const dests = map.get(move.from)
      if (dests) {
        dests.push(move.to)
      } else {
        map.set(move.from, [move.to])
      }
    }
    return map
  }

  isLegal(from: Position, to: Position): boolean {
    return this.legalMoves(from).some((m) => m.to === to)
  }

  apply(move: Move): Snapshot {
    const snap = this.engine.apply(this.ctx, move)
    this.ctx.sideToMove = PieceColor.opponent(this.ctx.sideToMove)
    const moveHash = MoveHash.create(snap, this.ctx)
    this.currentHash = this.hasher.hash(this.currentHash, moveHash)
    this.tracker.record(this.currentHash)
    return snap
  }

  undo(snap: Snapshot): void {
    this.ctx.sideToMove = PieceColor.opponent(this.ctx.sideToMove)
    const moveHash = MoveHash.create(snap, this.ctx)
    this.currentHash = this.hasher.hash(this.currentHash, moveHash)
    this.tracker.undo(this.currentHash)
    this.engine.undo(this.ctx, snap)
  }

  isCheck(): boolean {
    return this.engine.isSquareAttacked(
      MoveContext.sideOf(this.ctx, this.ctx.sideToMove).kingPosition,
      this.ctx.sideToMove === WHITE ? BLACK : WHITE,
      this.ctx
    )
  }

  status(): GameResult {
    return this.rules.getGameResult(
      this.ctx,
      this.engine,
      this.tracker,
      this.currentHash
    )
  }
}
