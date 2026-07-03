import type { TurnContext } from "./state"
import { MoveContext as MC, TurnContext as TC } from "./state"

import { Board, Square } from "./board"
import { Piece, KING, WHITE, BLACK } from "./piece"
import type { PieceColor } from "./piece"
import { Position, File, Rank, NO_POSITION, RANK_3, RANK_6 } from "./position"

function decodePiecePlacement(
  str: string,
  ctx: TurnContext,
  start: number
): [number, string | null] {
  let fenRank = 0
  let file = 0

  for (let i = start; i < str.length; i++) {
    const letter = str.charAt(i)

    if (letter === " ") {
      if (fenRank + 1 !== 8 || file !== 8) {
        return [0, `fen: expected 8 ranks, got ${fenRank + 1}`]
      }
      return [i + 1, null]
    }

    if (letter === "/") {
      if (file !== 8) {
        return [0, `fen: rank ${8 - fenRank} has ${file} files, want 8`]
      }
      file = 0
      fenRank++

      if (fenRank >= 8) {
        return [0, "fen: too many ranks"]
      }
      continue
    }

    const digit = letter.charCodeAt(0) - 48
    if (digit >= 1 && digit <= 8) {
      if (file + digit > 8) {
        return [0, `fen: rank ${8 - fenRank} overflows 8 files`]
      }
      file += digit
      continue
    }

    if (file >= 8) {
      return [0, `fen: rank ${8 - fenRank} overflows 8 files`]
    }

    const piece = Piece.parse(letter)
    if (!piece) {
      return [0, `fen: rank ${8 - fenRank}: invalid piece letter '${letter}'`]
    }

    const position = Position.create(File(file), Rank(7 - fenRank))
    Board.place(ctx.board, position, Square.create(piece))

    if (piece.type === KING) {
      MC.sideOf(ctx, piece.color).kingPosition = position
    }

    file++
  }

  return [0, "fen: piece placement field is incomplete, no space terminator"]
}

function decodeSideToMove(
  str: string,
  start: number,
  ctx: TurnContext
): [number, string | null] {
  if (start >= str.length) {
    return [0, "fen: missing side-to-move field"]
  }

  const letter = str.charAt(start)
  if (letter === "w") {
    ctx.sideToMove = WHITE
  } else if (letter === "b") {
    ctx.sideToMove = BLACK
  } else {
    return [0, `fen: invalid sideToMove letter '${letter}', expected w or b`]
  }

  return [start + 2, null]
}

function decodeCastlingRights(
  str: string,
  start: number,
  ctx: TurnContext
): [number, string | null] {
  if (start >= str.length) {
    return [0, "fen: missing castling-rights field"]
  }

  for (let i = start; i < str.length; i++) {
    const letter = str.charAt(i)
    if (letter === " ") {
      return [i + 1, null]
    }

    switch (letter) {
      case "K":
        MC.sideOf(ctx, WHITE).canCastleKingSide = true
        break
      case "Q":
        MC.sideOf(ctx, WHITE).canCastleQueenSide = true
        break
      case "k":
        MC.sideOf(ctx, BLACK).canCastleKingSide = true
        break
      case "q":
        MC.sideOf(ctx, BLACK).canCastleQueenSide = true
        break
      case "-":
        break
      default:
        return [
          0,
          `fen: invalid castle rights letter '${letter}', expected any of [K, Q, k, q, -]`,
        ]
    }
  }

  return [0, "fen: castling-rights field is incomplete, no space terminator"]
}

function decodeEnPassantTarget(
  str: string,
  start: number,
  ctx: TurnContext
): [number, string | null] {
  if (start >= str.length) {
    return [0, "fen: missing en-passant-target field"]
  }

  if (str[start] === "-") {
    ctx.enPassantTarget = NO_POSITION
    return [start + 2, null]
  }

  if (start + 1 >= str.length) {
    return [
      0,
      "fen: en-passant target is too short, expected a file letter and rank digit",
    ]
  }

  const file = File.parse(str.charAt(start))
  if (file === null) {
    return [
      0,
      `fen: en-passant target file: invalid file letter '${str[start]}'`,
    ]
  }

  const rank = Rank.parse(str.charAt(start + 1))
  if (rank === null) {
    return [
      0,
      `fen: en-passant target rank: invalid rank digit '${str[start + 1]}'`,
    ]
  }

  if (rank !== RANK_3 && rank !== RANK_6) {
    return [0, `fen: en-passant target rank must be 3 or 6, got ${rank + 1}`]
  }

  ctx.enPassantTarget = Position.create(file, rank)
  return [start + 3, null]
}

function decodeHalfMoveClock(
  str: string,
  start: number,
  ctx: TurnContext
): [number, string | null] {
  let i = start
  while (i < str.length && str[i] !== " ") {
    i++
  }

  if (i === start) {
    return [0, "fen: missing halfmove-clock field"]
  }

  const raw = str.slice(start, i)
  const clock = parseInt(raw, 10)
  if (isNaN(clock) || clock < 0) {
    return [0, `fen: invalid halfmove-clock '${raw}'`]
  }

  ctx.halfMoveClock = clock

  if (i < str.length) {
    i++
  }

  return [i, null]
}

function decodeFullMoveNumber(
  str: string,
  start: number,
  ctx: TurnContext
): string | null {
  let i = start
  while (i < str.length) {
    i++
  }

  if (i === start) {
    return "fen: missing fullmove-number field"
  }

  const raw = str.slice(start, i)
  const num = parseInt(raw, 10)
  if (isNaN(num) || num < 0) {
    return `fen: invalid fullmove-number '${raw}'`
  }

  ctx.fullMoveNumber = num
  return null
}

export function decodeFEN(str: string, ctx: TurnContext): string | null {
  ctx.board = Board.create()
  ctx.sideToMove = WHITE
  ctx.sides = [
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
  ]
  ctx.enPassantTarget = NO_POSITION
  ctx.halfMoveClock = 0
  ctx.fullMoveNumber = 0

  let index = 0
  let err: string | null

  ;[index, err] = decodePiecePlacement(str, ctx, index)
  if (err) return err

  ;[index, err] = decodeSideToMove(str, index, ctx)
  if (err) return err

  ;[index, err] = decodeCastlingRights(str, index, ctx)
  if (err) return err

  ;[index, err] = decodeEnPassantTarget(str, index, ctx)
  if (err) return err

  ;[index, err] = decodeHalfMoveClock(str, index, ctx)
  if (err) return err

  err = decodeFullMoveNumber(str, index, ctx)
  if (err) return err

  return null
}

function encodePiecePlacement(ctx: TurnContext): string {
  const parts: string[] = []

  for (let internalRank = 7; internalRank >= 0; internalRank--) {
    let empty = 0
    let rank = ""

    for (let f = 0; f < 8; f++) {
      const position = Position.create(File(f), Rank(internalRank))
      const square = Board.at(ctx.board, position)

      if (Square.isOccupied(square)) {
        if (empty > 0) {
          rank += String(empty)
        }
        empty = 0
        rank += Piece.toChar({
          type: Square.pieceType(square),
          color: Square.pieceColor(square),
        })
        continue
      }

      empty++
    }

    if (empty > 0) {
      rank += String(empty)
    }

    parts.push(rank)
  }

  return parts.join("/")
}

function encodeSideToMove(ctx: TurnContext): string {
  return ctx.sideToMove === WHITE ? "w" : "b"
}

function encodeCastlingRights(ctx: TurnContext): string {
  let result = ""

  if (MC.sideOf(ctx, WHITE).canCastleKingSide) result += "K"
  if (MC.sideOf(ctx, WHITE).canCastleQueenSide) result += "Q"

  if (MC.sideOf(ctx, BLACK).canCastleKingSide) result += "k"
  if (MC.sideOf(ctx, BLACK).canCastleQueenSide) result += "q"

  return result || "-"
}

function encodeEnPassantTarget(ctx: TurnContext): string {
  if (ctx.enPassantTarget === NO_POSITION) {
    return "-"
  }

  const file = String.fromCharCode(Position.file(ctx.enPassantTarget) + 97)
  const rank = String.fromCharCode(Position.rank(ctx.enPassantTarget) + 49)
  return file + rank
}

function encodeHalfMoveClock(ctx: TurnContext): string {
  return String(ctx.halfMoveClock)
}

function encodeFullMoveNumber(ctx: TurnContext): string {
  return String(ctx.fullMoveNumber)
}

export function encodeFEN(ctx: TurnContext): string {
  const parts = [
    encodePiecePlacement(ctx),
    encodeSideToMove(ctx),
    encodeCastlingRights(ctx),
    encodeEnPassantTarget(ctx),
    encodeHalfMoveClock(ctx),
    encodeFullMoveNumber(ctx),
  ]

  return parts.join(" ")
}

export const FEN = {
  decode(str: string, ctx?: TurnContext): TurnContext | string | null {
    if (ctx !== undefined) {
      return decodeFEN(str, ctx)
    }

    const decoded = TC.create()
    const err = decodeFEN(str, decoded)
    if (err) return err
    return decoded
  },

  encode(ctx: TurnContext): string {
    return encodeFEN(ctx)
  },

  decodeFEN,

  encodeFEN,

  boardFromFEN(fen: string): Board | null {
    const ctx = TC.create()
    const err = decodeFEN(fen, ctx)
    if (err) return null
    return ctx.board
  },

  /** Just the side-to-move field — for UI that only needs whose turn it
   * is (a turn indicator, a click-to-move guard) without decoding the
   * full board. */
  sideToMoveFromFEN(fen: string): PieceColor | null {
    const ctx = TC.create()
    const err = decodeFEN(fen, ctx)
    if (err) return null
    return ctx.sideToMove
  },
}
