import type { Board } from "./board"
import type { PieceColor } from "./piece"
import { WHITE } from "./piece"
import { NO_POSITION } from "./position"
import type { Position } from "./position"

export interface SideState {
  kingPosition: Position
  canCastleKingSide: boolean
  canCastleQueenSide: boolean
}

export interface BoardContext {
  board: Board
}

export interface MoveContext extends BoardContext {
  sideToMove: PieceColor
  sides: [SideState, SideState]
  enPassantTarget: Position
}

export const MoveContext = {
  sideOf(ctx: MoveContext, color: PieceColor): SideState {
    return color === WHITE ? ctx.sides[0] : ctx.sides[1]
  },
}

export interface ClockContext {
  halfMoveClock: number
  fullMoveNumber: number
}

export interface TurnContext extends MoveContext, ClockContext {}

export const TurnContext = {
  create(): TurnContext {
    return {
      board: new Uint8Array(64) as Board,
      sideToMove: WHITE,
      sides: [
        {
          kingPosition: NO_POSITION,
          canCastleKingSide: false,
          canCastleQueenSide: false,
        },
        {
          kingPosition: NO_POSITION,
          canCastleKingSide: false,
          canCastleQueenSide: false,
        },
      ],
      enPassantTarget: NO_POSITION,
      halfMoveClock: 0,
      fullMoveNumber: 0,
    }
  },
}
