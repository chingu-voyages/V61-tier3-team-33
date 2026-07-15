import type { Brand } from "../../chess/core/brand";
export {
  BISHOP,
  BLACK,
  CASTLING,
  CHECKMATE,
  type ChessConfig,
  DRAW,
  DrawReason,
  EN_PASSANT,
  FIFTY_MOVE_RULE,
  type File,
  FILE_A,
  FILE_B,
  FILE_C,
  FILE_D,
  FILE_E,
  FILE_F,
  FILE_G,
  FILE_H,
  type GameResult,
  GameStatus,
  IN_PROGRESS,
  INSUFFICIENT_MATERIAL,
  KING,
  KNIGHT,
  MAX_MOVES,
  type Move,
  MoveType,
  NO_DRAW_REASON,
  NO_POSITION,
  NORMAL,
  PAWN,
  type Piece,
  PieceColor,
  PieceType,
  Position,
  PROMOTION,
  QUEEN,
  type Rank,
  RANK_1,
  RANK_2,
  RANK_3,
  RANK_4,
  RANK_5,
  RANK_6,
  RANK_7,
  RANK_8,
  ROOK,
  STALEMATE,
  STARTING_FEN,
  THREEFOLD_REPETITION,
  WHITE,
} from "../../chess";
export { Board, EMPTY_SQUARE, Square } from "../../chess/core/board";
export type { Brand } from "../../chess/core/brand";
export type { BoardContext, ClockContext } from "../../chess/core/state";
export { MoveContext, SideState, TurnContext } from "../../chess/core/state";

export function brandedTag<Tag extends string>() {
  return function make<T extends string>(value: T): Brand<T, Tag> {
    return value as Brand<T, Tag>;
  };
}
