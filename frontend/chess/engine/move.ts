import type { IPieces } from "../piece/piece"
import type { TurnContext } from "../core/state"

import { Square } from "../core/board"
import { KING, PieceColor } from "../core/piece"
import { Move } from "../core/move"
import { Position } from "../core/position"
import { MoveContext } from "../core/state"
import { applyImpl } from "./apply"
import { undoImpl } from "./undo"
import { getPseudoLegalMovesImpl } from "./psuedo"
import { isSquareAttackedImpl } from "./attack"

export function getLegalMovesImpl(
  pieces: IPieces,
  moves: Move[],
  position: Position,
  ctx: TurnContext
): Move[] {
  moves = getPseudoLegalMovesImpl(pieces, moves, position, ctx)

  const current = ctx.sideToMove
  const enemy = PieceColor.opponent(current)
  const kingStart = MoveContext.sideOf(ctx, current).kingPosition

  let slot = 0
  for (const move of moves) {
    const snap = applyImpl(ctx, move)

    const kingPosition = move.piece.type === KING ? move.to : kingStart
    const kingIsAttacked = isSquareAttackedImpl(
      pieces,
      kingPosition,
      enemy,
      ctx
    )

    undoImpl(ctx, snap)

    if (kingIsAttacked) {
      continue
    }

    moves[slot] = move
    slot++
  }

  moves.length = slot
  return moves
}

export function getAllLegalMovesImpl(
  pieces: IPieces,
  moves: Move[],
  ctx: TurnContext
): Move[] {
  const current = ctx.sideToMove
  const enemy = PieceColor.opponent(current)
  const scratch: Move[] = []

  for (const [i, rawByte] of ctx.board.entries()) {
    const position = Position(i)
    const square = Square(rawByte)
    if (Square.isEmpty(square) || Square.isOccupiedBy(square, enemy)) {
      continue
    }

    scratch.length = 0
    const pieceMoves = getLegalMovesImpl(pieces, scratch, position, ctx)

    moves.push(...pieceMoves)
  }

  return moves
}

export function hasAnyLegalMovesImpl(
  pieces: IPieces,
  ctx: TurnContext
): boolean {
  const current = ctx.sideToMove
  const enemy = PieceColor.opponent(current)
  const kingStart = MoveContext.sideOf(ctx, current).kingPosition

  for (const [i, rawByte] of ctx.board.entries()) {
    const position = Position(i)
    const square = Square(rawByte)
    if (Square.isEmpty(square) || Square.isOccupiedBy(square, enemy)) {
      continue
    }

    const scratch: Move[] = []
    const pseudoMoves = getPseudoLegalMovesImpl(pieces, scratch, position, ctx)
    for (const move of pseudoMoves) {
      const snap = applyImpl(ctx, move)

      const kingPosition = move.piece.type === KING ? move.to : kingStart
      const kingIsAttacked = isSquareAttackedImpl(
        pieces,
        kingPosition,
        enemy,
        ctx
      )

      undoImpl(ctx, snap)

      if (kingIsAttacked) {
        continue
      }

      return true
    }
  }

  return false
}

export function isLegalMoveImpl(
  pieces: IPieces,
  move: Move,
  ctx: TurnContext
): boolean {
  const buf: Move[] = []
  const moves = getLegalMovesImpl(pieces, buf, move.from, ctx)

  for (const m of moves) {
    if (Move.isEqual(m, move)) {
      return true
    }
  }

  return false
}
