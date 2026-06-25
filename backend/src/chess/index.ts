// Orchestrator
export { Chess } from "./chess";

// Configuration
export { STARTING_FEN } from "./config";
export type { ChessConfig } from "./config";

// Errors
export {
  FENError,
  IllegalMoveError,
  InvalidSquareError,
  NothingToUndoError,
} from "./errors";

// Core types — value exports (namespace methods needed by consumers)
export { Position, NO_POSITION } from "./core/position";

// Core types — type-only exports
export type { File, Rank } from "./core/position";
export type { Piece, PieceType, PieceColor } from "./core/piece";
export type { Move, MoveType } from "./core/move";
export type { GameResult, GameStatus, DrawReason } from "./core/game";
export type { ChessState } from "./core/state";

// Constants — move utilities
export { MAX_MOVES } from "./core/move";

// Constants — square names
export {
  A1, A2, A3, A4, A5, A6, A7, A8,
  B1, B2, B3, B4, B5, B6, B7, B8,
  C1, C2, C3, C4, C5, C6, C7, C8,
  D1, D2, D3, D4, D5, D6, D7, D8,
  E1, E2, E3, E4, E5, E6, E7, E8,
  F1, F2, F3, F4, F5, F6, F7, F8,
  G1, G2, G3, G4, G5, G6, G7, G8,
  H1, H2, H3, H4, H5, H6, H7, H8,
} from "./core/position";

// Constants — file and rank names
export {
  FILE_A, FILE_B, FILE_C, FILE_D, FILE_E, FILE_F, FILE_G, FILE_H,
  RANK_1, RANK_2, RANK_3, RANK_4, RANK_5, RANK_6, RANK_7, RANK_8,
} from "./core/position";

// Constants — piece types
export { PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING } from "./core/piece";

// Constants — colors
export { WHITE, BLACK } from "./core/piece";

// Constants — move types
export { NORMAL, CASTLING, EN_PASSANT, PROMOTION } from "./core/move";

// Constants — game status
export { IN_PROGRESS, CHECKMATE, DRAW } from "./core/game";

// Constants — draw reasons
export {
  NO_DRAW_REASON,
  STALEMATE,
  THREEFOLD_REPETITION,
  FIFTY_MOVE_RULE,
  INSUFFICIENT_MATERIAL,
} from "./core/game";
