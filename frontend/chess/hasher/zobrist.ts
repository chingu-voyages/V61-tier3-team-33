import type { Piece } from "../core/piece"
import type { TurnContext } from "../core/state"
import type { MoveHash } from "../core/hash"
import type { IHasher } from "./hasher"

import { Square } from "../core/board"
import { ROOK, BLACK } from "../core/piece"
import { Position } from "../core/position"
import { Move, NORMAL, PROMOTION, CASTLING, EN_PASSANT } from "../core/move"

const PIECE_POSITION_COUNT = 12 * 64
const CASTLING_OFFSET = PIECE_POSITION_COUNT
const EN_PASSANT_OFFSET = CASTLING_OFFSET + 4
const SIDE_TO_MOVE_OFFSET = EN_PASSANT_OFFSET + 8
const TOTAL_KEYS = SIDE_TO_MOVE_OFFSET + 1

export class Zobrist implements IHasher {
  private readonly piecePosition: BigUint64Array
  private readonly castling: BigUint64Array
  private readonly enPassant: BigUint64Array
  private readonly sideToMoveBit: bigint

  constructor() {
    const buffer = new BigUint64Array(TOTAL_KEYS)
    crypto.getRandomValues(buffer)

    this.piecePosition = buffer.subarray(0, CASTLING_OFFSET)
    this.castling = buffer.subarray(CASTLING_OFFSET, EN_PASSANT_OFFSET)
    this.enPassant = buffer.subarray(EN_PASSANT_OFFSET, SIDE_TO_MOVE_OFFSET)
    this.sideToMoveBit = buffer[SIDE_TO_MOVE_OFFSET]!
  }

  initHash(ctx: TurnContext): bigint {
    let hash = BigInt(0)

    for (const [squareIndex, rawByte] of ctx.board.entries()) {
      if (!rawByte) continue
      hash ^= this.piecePosition[this.tableOffset(rawByte - 1, squareIndex)]!
    }

    if (ctx.sides[0]!.canCastleKingSide) hash ^= this.castling[0]!
    if (ctx.sides[0]!.canCastleQueenSide) hash ^= this.castling[1]!
    if (ctx.sides[1]!.canCastleKingSide) hash ^= this.castling[2]!
    if (ctx.sides[1]!.canCastleQueenSide) hash ^= this.castling[3]!

    if (Position.isValid(ctx.enPassantTarget)) {
      hash ^= this.enPassant[Position.file(ctx.enPassantTarget)]!
    }

    if (ctx.sideToMove === BLACK) {
      hash ^= this.sideToMoveBit
    }

    return hash
  }

  hash(current: bigint, moveHash: MoveHash): bigint {
    let hash = current

    switch (moveHash.move.type) {
      case NORMAL:
        hash = this.hashNormal(hash, moveHash)
        break
      case PROMOTION:
        hash = this.hashPromotion(hash, moveHash)
        break
      case CASTLING:
        hash = this.hashCastling(hash, moveHash)
        break
      case EN_PASSANT:
        hash = this.hashEnPassant(hash, moveHash)
        break
    }

    hash = this.hashCastlingRights(hash, moveHash)
    hash = this.hashEnPassantTarget(hash, moveHash)
    hash ^= this.sideToMoveBit

    return hash
  }

  private hashNormal(hash: bigint, moveHash: MoveHash): bigint {
    const move = moveHash.move
    const pieceIndex = this.pieceIndex(move.piece)

    hash ^= this.piecePosition[this.tableOffset(pieceIndex, move.from)]!
    hash ^= this.piecePosition[this.tableOffset(pieceIndex, move.to)]!

    if (move.captured) {
      hash ^=
        this.piecePosition[
          this.tableOffset(this.pieceIndex(move.captured), move.to)
        ]!
    }

    return hash
  }

  private hashPromotion(hash: bigint, moveHash: MoveHash): bigint {
    const move = moveHash.move
    const pawnIndex = this.pieceIndex(move.piece)

    hash ^= this.piecePosition[this.tableOffset(pawnIndex, move.from)]!

    const promoteTo = move.promoteTo
    if (promoteTo === null) return hash

    hash ^=
      this.piecePosition[
        this.tableOffset(
          this.pieceIndex({ type: promoteTo, color: move.piece.color }),
          move.to
        )
      ]!

    if (move.captured) {
      hash ^=
        this.piecePosition[
          this.tableOffset(this.pieceIndex(move.captured), move.to)
        ]!
    }

    return hash
  }

  private hashCastling(hash: bigint, moveHash: MoveHash): bigint {
    const move = moveHash.move
    const kingIndex = this.pieceIndex(move.piece)
    const rookIndex = this.pieceIndex({ type: ROOK, color: move.piece.color })
    const [rookFrom, rookTo] = Move.castlingRookPositions(move)

    hash ^= this.piecePosition[this.tableOffset(kingIndex, move.from)]!
    hash ^= this.piecePosition[this.tableOffset(kingIndex, move.to)]!
    hash ^= this.piecePosition[this.tableOffset(rookIndex, rookFrom)]!
    hash ^= this.piecePosition[this.tableOffset(rookIndex, rookTo)]!

    return hash
  }

  private hashEnPassant(hash: bigint, moveHash: MoveHash): bigint {
    const move = moveHash.move
    const pieceIndex = this.pieceIndex(move.piece)

    hash ^= this.piecePosition[this.tableOffset(pieceIndex, move.from)]!
    hash ^= this.piecePosition[this.tableOffset(pieceIndex, move.to)]!

    if (move.captured) {
      hash ^=
        this.piecePosition[
          this.tableOffset(
            this.pieceIndex(move.captured),
            Move.enPassantCapturedPosition(move)
          )
        ]!
    }

    return hash
  }

  private hashCastlingRights(hash: bigint, moveHash: MoveHash): bigint {
    const prevW = moveHash.previousSides[0]!
    const newW = moveHash.newSides[0]!
    if (prevW.canCastleKingSide !== newW.canCastleKingSide)
      hash ^= this.castling[0]!
    if (prevW.canCastleQueenSide !== newW.canCastleQueenSide)
      hash ^= this.castling[1]!

    const prevB = moveHash.previousSides[1]!
    const newB = moveHash.newSides[1]!
    if (prevB.canCastleKingSide !== newB.canCastleKingSide)
      hash ^= this.castling[2]!
    if (prevB.canCastleQueenSide !== newB.canCastleQueenSide)
      hash ^= this.castling[3]!

    return hash
  }

  private hashEnPassantTarget(hash: bigint, moveHash: MoveHash): bigint {
    if (Position.isValid(moveHash.previousEnPassantTarget)) {
      hash ^= this.enPassant[Position.file(moveHash.previousEnPassantTarget)]!
    }

    if (Move.isDoublePawnPush(moveHash.move)) {
      hash ^=
        this.enPassant[Position.file(Move.enPassantTarget(moveHash.move))]!
    }

    return hash
  }

  private tableOffset(pieceIndex: number, square: number): number {
    return pieceIndex * 64 + square
  }

  private pieceIndex(piece: Piece): number {
    return Square.create(piece) - 1
  }
}
