import type { Brand } from "../../chess/core/brand";
export type { Brand } from "../../chess/core/brand";
export { Square, Board, EMPTY_SQUARE } from "../../chess/core/board";
export type { BoardContext, ClockContext } from "../../chess/core/state";
export { TurnContext, MoveContext, SideState } from "../../chess/core/state";
export {
  PieceType,
  PieceColor,
  type Piece,
  PAWN,
  KNIGHT,
  BISHOP,
  ROOK,
  QUEEN,
  KING,
  WHITE,
  BLACK,
  Position,
  type File,
  type Rank,
  NO_POSITION,
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
  type Move,
  MoveType,
  NORMAL,
  CASTLING,
  EN_PASSANT,
  PROMOTION,
  MAX_MOVES,
  type GameResult,
  GameStatus,
  DrawReason,
  IN_PROGRESS,
  CHECKMATE,
  DRAW,
  NO_DRAW_REASON,
  STALEMATE,
  THREEFOLD_REPETITION,
  FIFTY_MOVE_RULE,
  INSUFFICIENT_MATERIAL,
  STARTING_FEN,
  type ChessConfig,
} from "../../chess";

export function brandedTag<Tag extends string>() {
  return function make<T extends string>(value: T): Brand<T, Tag> {
    return value as Brand<T, Tag>;
  };
}
