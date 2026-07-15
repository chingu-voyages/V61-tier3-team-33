// Orchestrator
export { Chess } from "./chess";

// Branding
export type { Brand } from "./core/brand";

// Configuration
export type { ChessConfig } from "./config";
export { STARTING_FEN } from "./config";

// Errors
export { FENError, IllegalMoveError, InvalidSquareError, NothingToUndoError } from "./errors";

// Core types — value exports (namespace methods needed by consumers)
export { NO_POSITION, Position } from "./core/position";

// Core types — type-only exports
export type { GameResult } from "./core/game";
export type { Move } from "./core/move";
export type { Piece } from "./core/piece";
export { File, Rank } from "./core/position";
export type { ChessState, TurnContext } from "./core/state";

// Constants — move utilities
export { MAX_MOVES } from "./core/move";

// Constants — square names
export {
  A1,
  A2,
  A3,
  A4,
  A5,
  A6,
  A7,
  A8,
  B1,
  B2,
  B3,
  B4,
  B5,
  B6,
  B7,
  B8,
  C1,
  C2,
  C3,
  C4,
  C5,
  C6,
  C7,
  C8,
  D1,
  D2,
  D3,
  D4,
  D5,
  D6,
  D7,
  D8,
  E1,
  E2,
  E3,
  E4,
  E5,
  E6,
  E7,
  E8,
  F1,
  F2,
  F3,
  F4,
  F5,
  F6,
  F7,
  F8,
  G1,
  G2,
  G3,
  G4,
  G5,
  G6,
  G7,
  G8,
  H1,
  H2,
  H3,
  H4,
  H5,
  H6,
  H7,
  H8,
} from "./core/position";

// Constants — file and rank names
export {
  FILE_A,
  FILE_B,
  FILE_C,
  FILE_D,
  FILE_E,
  FILE_F,
  FILE_G,
  FILE_H,
  RANK_1,
  RANK_2,
  RANK_3,
  RANK_4,
  RANK_5,
  RANK_6,
  RANK_7,
  RANK_8,
} from "./core/position";

// Constants — piece types
export { BISHOP, BLACK, KING, KNIGHT, PAWN, PieceColor, PieceType, QUEEN, ROOK, WHITE } from "./core/piece";

// Constants — move types
export { CASTLING, EN_PASSANT, MoveType, NORMAL, PROMOTION } from "./core/move";

// Constants — game status
export { CHECKMATE, DRAW, DrawReason, GameStatus, IN_PROGRESS } from "./core/game";

// Constants — draw reasons
export { FIFTY_MOVE_RULE, INSUFFICIENT_MATERIAL, NO_DRAW_REASON, STALEMATE, THREEFOLD_REPETITION } from "./core/game";
export type { ISan } from "./parser/san";
export { SAN, San } from "./parser/san";
