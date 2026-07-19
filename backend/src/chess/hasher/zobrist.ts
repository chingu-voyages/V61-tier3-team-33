import { Square } from "../core/board";
import type { MoveHash } from "../core/hash";
import { CASTLING, EN_PASSANT, Move, NORMAL, PROMOTION } from "../core/move";
import type { Piece } from "../core/piece";
import { BLACK, ROOK } from "../core/piece";
import { Position } from "../core/position";
import type { TurnContext } from "../core/state";
import type { IHasher } from "./hasher";

// 768 piece-position + 4 castling + 8 en-passant + 1 side-to-move = 781 keys.
const PIECE_POSITION_COUNT = 12 * 64;
const CASTLING_OFFSET = PIECE_POSITION_COUNT;
const EN_PASSANT_OFFSET = CASTLING_OFFSET + 4;
const SIDE_TO_MOVE_OFFSET = EN_PASSANT_OFFSET + 8;
const TOTAL_KEYS = SIDE_TO_MOVE_OFFSET + 1;

/**
 * Zobrist hashing for chess positions using 64-bit keys.
 *
 * Each piece-on-square, castling right, en passant file, and side-to-move
 * contributes a random 64-bit constant combined with XOR.  Because XOR is its
 * own inverse, `hash()` is called identically after Apply and before Undo.
 *
 * Keys are generated from `crypto.getRandomValues()` once at construction —
 * no PRNG to seed or reimplement.  True 64-bit values via BigUint64Array.
 *
 * Table layout:
 *   piecePosition  [12 × 64]  — piece index 0–11 × square 0–63
 *   castling       [4]        — [0] white K-side, [1] white Q-side,
 *                               [2] black K-side, [3] black Q-side
 *   enPassant      [8]        — file index A=0 … H=7
 *   sideToMoveBit             — XOR'd in when it is black's turn
 *
 * Piece index = Square byte − 1  (Square encodes color * 6 + type + 1):
 *   WHITE: PAWN=0, KNIGHT=1, BISHOP=2, ROOK=3, QUEEN=4, KING=5
 *   BLACK: PAWN=6, KNIGHT=7, BISHOP=8, ROOK=9, QUEEN=10, KING=11
 */
export class Zobrist implements IHasher {
  private readonly piecePosition: BigUint64Array;
  private readonly castling: BigUint64Array;
  private readonly enPassant: BigUint64Array;
  private readonly sideToMoveBit: bigint;

  constructor() {
    const buffer = new BigUint64Array(TOTAL_KEYS);
    crypto.getRandomValues(buffer);

    this.piecePosition = buffer.subarray(0, CASTLING_OFFSET);
    this.castling = buffer.subarray(CASTLING_OFFSET, EN_PASSANT_OFFSET);
    this.enPassant = buffer.subarray(EN_PASSANT_OFFSET, SIDE_TO_MOVE_OFFSET);
    this.sideToMoveBit = buffer[SIDE_TO_MOVE_OFFSET]!;
  }

  /** Computes a full Zobrist hash from scratch. */
  initHash(ctx: TurnContext): bigint {
    let hash = 0n;

    // xor in every piece that sits on the board
    for (const [squareIndex, rawByte] of ctx.board.entries()) {
      if (!rawByte) continue;

      // rawByte is a Square byte (1–12).  Square encoding is
      // color * 6 + type + 1, so rawByte − 1 is the 0-based
      // piece index into the Zobrist table (0–11).
      hash ^= this.piecePosition[this.tableOffset(rawByte - 1, squareIndex)]!;
    }

    // xor in castling rights
    if (ctx.sides[0]!.canCastleKingSide) hash ^= this.castling[0]!;
    if (ctx.sides[0]!.canCastleQueenSide) hash ^= this.castling[1]!;
    if (ctx.sides[1]!.canCastleKingSide) hash ^= this.castling[2]!;
    if (ctx.sides[1]!.canCastleQueenSide) hash ^= this.castling[3]!;

    // xor in the en passant target file, if one exists
    if (Position.isValid(ctx.enPassantTarget)) {
      const file = Position.file(ctx.enPassantTarget);
      hash ^= this.enPassant[file]!;
    }

    // xor in the side-to-move bit for black
    if (ctx.sideToMove === BLACK) {
      hash ^= this.sideToMoveBit;
    }

    return hash;
  }

  /** Incrementally updates `current` for `moveHash`. */
  hash(current: bigint, moveHash: MoveHash): bigint {
    let hash = current;

    switch (moveHash.move.type) {
      case NORMAL:
        hash = this.hashNormal(hash, moveHash);
        break;
      case PROMOTION:
        hash = this.hashPromotion(hash, moveHash);
        break;
      case CASTLING:
        hash = this.hashCastling(hash, moveHash);
        break;
      case EN_PASSANT:
        hash = this.hashEnPassant(hash, moveHash);
        break;
    }

    hash = this.hashCastlingRights(hash, moveHash);
    hash = this.hashEnPassantTarget(hash, moveHash);
    hash ^= this.sideToMoveBit;

    return hash;
  }

  private hashNormal(hash: bigint, moveHash: MoveHash): bigint {
    const move = moveHash.move;
    const pieceIndex = this.pieceIndex(move.piece);

    // move piece out of its old square and into the new one
    hash ^= this.piecePosition[this.tableOffset(pieceIndex, move.from)]!;
    hash ^= this.piecePosition[this.tableOffset(pieceIndex, move.to)]!;

    // xor out the captured piece, if any
    if (move.captured) {
      const capturedIndex = this.pieceIndex(move.captured);
      hash ^= this.piecePosition[this.tableOffset(capturedIndex, move.to)]!;
    }

    return hash;
  }

  private hashPromotion(hash: bigint, moveHash: MoveHash): bigint {
    const move = moveHash.move;
    const pawnIndex = this.pieceIndex(move.piece);

    // pawn leaves its old square
    hash ^= this.piecePosition[this.tableOffset(pawnIndex, move.from)]!;

    const promoteTo = move.promoteTo;
    if (promoteTo === null) return hash;

    // promoted piece appears on the destination
    const promotedIndex = this.pieceIndex({
      type: promoteTo,
      color: move.piece.color,
    });
    hash ^= this.piecePosition[this.tableOffset(promotedIndex, move.to)]!;

    // xor out the captured piece on the promotion square, if any
    if (move.captured) {
      const capturedIndex = this.pieceIndex(move.captured);
      hash ^= this.piecePosition[this.tableOffset(capturedIndex, move.to)]!;
    }

    return hash;
  }

  private hashCastling(hash: bigint, moveHash: MoveHash): bigint {
    const move = moveHash.move;
    const kingIndex = this.pieceIndex(move.piece);
    const rookIndex = this.pieceIndex({ type: ROOK, color: move.piece.color });
    const [rookFrom, rookTo] = Move.castlingRookPositions(move);

    // move both king and rook
    hash ^= this.piecePosition[this.tableOffset(kingIndex, move.from)]!;
    hash ^= this.piecePosition[this.tableOffset(kingIndex, move.to)]!;
    hash ^= this.piecePosition[this.tableOffset(rookIndex, rookFrom)]!;
    hash ^= this.piecePosition[this.tableOffset(rookIndex, rookTo)]!;

    return hash;
  }

  private hashEnPassant(hash: bigint, moveHash: MoveHash): bigint {
    const move = moveHash.move;
    const pieceIndex = this.pieceIndex(move.piece);

    // move the capturing pawn
    hash ^= this.piecePosition[this.tableOffset(pieceIndex, move.from)]!;
    hash ^= this.piecePosition[this.tableOffset(pieceIndex, move.to)]!;

    const captured = move.captured;
    if (captured === null) return hash;

    // xor out the captured pawn (it sits one rank behind the destination)
    const capturedIndex = this.pieceIndex(captured);
    const capturedPosition = Move.enPassantCapturedPosition(move);
    hash ^= this.piecePosition[this.tableOffset(capturedIndex, capturedPosition)]!;

    return hash;
  }

  // xor in/out the castling rights that changed between previous and new sides
  private hashCastlingRights(hash: bigint, moveHash: MoveHash): bigint {
    const previousWhite = moveHash.previousSides[0]!;
    const newWhite = moveHash.newSides[0]!;
    if (previousWhite.canCastleKingSide !== newWhite.canCastleKingSide) {
      hash ^= this.castling[0]!;
    }
    if (previousWhite.canCastleQueenSide !== newWhite.canCastleQueenSide) {
      hash ^= this.castling[1]!;
    }

    const previousBlack = moveHash.previousSides[1]!;
    const newBlack = moveHash.newSides[1]!;
    if (previousBlack.canCastleKingSide !== newBlack.canCastleKingSide) {
      hash ^= this.castling[2]!;
    }
    if (previousBlack.canCastleQueenSide !== newBlack.canCastleQueenSide) {
      hash ^= this.castling[3]!;
    }

    return hash;
  }

  // xor out the old en passant target, xor in the new one (if either exists)
  private hashEnPassantTarget(hash: bigint, moveHash: MoveHash): bigint {
    if (Position.isValid(moveHash.previousEnPassantTarget)) {
      const file = Position.file(moveHash.previousEnPassantTarget);
      hash ^= this.enPassant[file]!;
    }

    if (Move.isDoublePawnPush(moveHash.move)) {
      const target = Move.enPassantTarget(moveHash.move);
      const file = Position.file(target);
      hash ^= this.enPassant[file]!;
    }

    return hash;
  }

  // piecePosition is a flat BigUint64Array of 12 rows × 64 columns.
  // Each row holds 64 random keys, one per board square.  The flat
  // index is row × 64 + column — same as Position encoding (file * 8 + rank),
  // just extended to 12 piece types instead of 8 ranks.
  private tableOffset(pieceIndex: number, square: number): number {
    return pieceIndex * 64 + square;
  }

  // Square byte encodes color * 6 + type + 1, so value − 1 = 0-based index
  private pieceIndex(piece: Piece): number {
    return Square.create(piece) - 1;
  }
}
