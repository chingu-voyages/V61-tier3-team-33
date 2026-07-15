import { Board, Square } from "../core/board";
import type { Move } from "../core/move";
import { CASTLING } from "../core/move";
import type { Piece } from "../core/piece";
import { BISHOP, KING, KNIGHT, PAWN, PieceColor, QUEEN, ROOK } from "../core/piece";
import type { Rank } from "../core/position";
import { FILE_B, FILE_C, FILE_D, FILE_E, FILE_F, FILE_G, Position } from "../core/position";
import type { TurnContext } from "../core/state";
import { MoveContext } from "../core/state";
import type { IPieces } from "../piece/piece";
import { isSquareAttackedImpl } from "./attack";

export function getPseudoLegalMovesImpl(pieces: IPieces, moves: Move[], position: Position, ctx: TurnContext): Move[] {
  const square = Board.at(ctx.board, position);
  if (!Square.isOccupiedBy(square, ctx.sideToMove)) {
    return moves;
  }

  const pieceType = Square.pieceType(square);

  switch (pieceType) {
    case PAWN:
      moves = pieces.pawn.pseudoLegalMoves(moves, position, ctx);
      break;
    case KNIGHT:
      moves = pieces.knight.pseudoLegalMoves(moves, position, ctx);
      break;
    case BISHOP:
      moves = pieces.bishop.pseudoLegalMoves(moves, position, ctx);
      break;
    case ROOK:
      moves = pieces.rook.pseudoLegalMoves(moves, position, ctx);
      break;
    case QUEEN:
      moves = pieces.queen.pseudoLegalMoves(moves, position, ctx);
      break;
    case KING:
      moves = pieces.king.pseudoLegalMoves(moves, position, ctx);
      break;
  }

  // add castling moves
  if (MoveContext.isKingAt(ctx, position)) {
    moves = castlingMovesImpl(pieces, moves, position, ctx);
  }

  return moves;
}

// return king castling moves, if rights are valid
function castlingMovesImpl(pieces: IPieces, moves: Move[], kingPosition: Position, ctx: TurnContext): Move[] {
  const current = ctx.sideToMove;
  const enemy = PieceColor.opponent(current);

  // if the king isn't on the starting file, no castling
  if (Position.file(kingPosition) !== FILE_E) {
    return moves;
  }

  // if the king is in check, no castling
  if (isSquareAttackedImpl(pieces, kingPosition, enemy, ctx)) {
    return moves;
  }

  const rank = Position.rank(kingPosition);
  const king: Piece = { type: KING, color: current };

  if (canCastleKingSideImpl(pieces, rank, ctx)) {
    moves.push({
      type: CASTLING,
      piece: king,
      from: kingPosition,
      to: Position.create(FILE_G, rank),
      captured: null,
      promoteTo: null,
    });
  }

  if (canCastleQueenSideImpl(pieces, rank, ctx)) {
    moves.push({
      type: CASTLING,
      piece: king,
      from: kingPosition,
      to: Position.create(FILE_C, rank),
      captured: null,
      promoteTo: null,
    });
  }

  return moves;
}

// canCastleKingSideImpl return true, if rights allow the king to castle from king side
function canCastleKingSideImpl(pieces: IPieces, rank: Rank, ctx: TurnContext): boolean {
  if (!MoveContext.sideOf(ctx, ctx.sideToMove).canCastleKingSide) {
    return false;
  }

  const enemy = PieceColor.opponent(ctx.sideToMove);

  const path = Position.create(FILE_F, rank);
  const dest = Position.create(FILE_G, rank);

  if (Board.isOccupiedAt(ctx.board, path) || Board.isOccupiedAt(ctx.board, dest)) {
    return false;
  }

  if (isSquareAttackedImpl(pieces, path, enemy, ctx) || isSquareAttackedImpl(pieces, dest, enemy, ctx)) {
    return false;
  }

  return true;
}

// canCastleQueenSideImpl return true, if rights allow the king to castle from queen side
function canCastleQueenSideImpl(pieces: IPieces, rank: Rank, ctx: TurnContext): boolean {
  if (!MoveContext.sideOf(ctx, ctx.sideToMove).canCastleQueenSide) {
    return false;
  }

  const enemy = PieceColor.opponent(ctx.sideToMove);

  const between = Position.create(FILE_B, rank);
  const dest = Position.create(FILE_C, rank);
  const path = Position.create(FILE_D, rank);

  if (
    Board.isOccupiedAt(ctx.board, path) ||
    Board.isOccupiedAt(ctx.board, dest) ||
    Board.isOccupiedAt(ctx.board, between)
  ) {
    return false;
  }

  if (isSquareAttackedImpl(pieces, path, enemy, ctx) || isSquareAttackedImpl(pieces, dest, enemy, ctx)) {
    return false;
  }

  return true;
}
