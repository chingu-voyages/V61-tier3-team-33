import type {
  Brand,
  PieceType,
  PieceColor,
  GameResult,
  GameStatus,
  DrawReason,
  Position,
  Move,
  TurnContext,
} from "../../chess";

// Re-exports from chess submodules (not in barrel)
export type { Brand } from "../../chess/core/brand";
export { Square, Board, EMPTY_SQUARE } from "../../chess/core/board";
export type { BoardContext, ClockContext } from "../../chess/core/state";
export { TurnContext, MoveContext, SideState } from "../../chess/core/state";

// Re-exports from chess barrel
export {
  // Piece types & colors
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
  // Position
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
  // Move
  type Move,
  MoveType,
  NORMAL,
  CASTLING,
  EN_PASSANT,
  PROMOTION,
  MAX_MOVES,
  // Game result & status
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
  // Config
  STARTING_FEN,
  type ChessConfig,
} from "../../chess";

// Game lifecycle
// Distinct from the engine's GameStatus (IN_PROGRESS/CHECKMATE/DRAW) which
// describes the chess position, not the game's lifecycle.
export type Lifecycle = Brand<number, "Lifecycle">;
export const Lifecycle = (value: number): Lifecycle => value as Lifecycle;
export const WAITING: Lifecycle = Lifecycle(0);
export const ACTIVE: Lifecycle = Lifecycle(1);
export const FINISHED: Lifecycle = Lifecycle(2);

// What kind of game this is.
export type Mode = Brand<number, "Mode">;
export const Mode = (value: number): Mode => value as Mode;
export const HUMAN_VS_HUMAN: Mode = Mode(0);
export const HUMAN_VS_AI: Mode = Mode(1);
export const AI_VS_AI: Mode = Mode(2);

// AI strength; only meaningful when mode !== HUMAN_VS_HUMAN.
export type Difficulty = Brand<number, "Difficulty">;
export const Difficulty = (value: number): Difficulty => value as Difficulty;
export const EASY: Difficulty = Difficulty(0);
export const MEDIUM: Difficulty = Difficulty(1);
export const HARD: Difficulty = Difficulty(2);

// Why a game ended; RULES defers to status/drawReason for detail.
export type EndReason = Brand<number, "EndReason">;
export const EndReason = (value: number): EndReason => value as EndReason;
export const RULES: EndReason = EndReason(0);
export const TIMEOUT: EndReason = EndReason(1);
export const RESIGNATION: EndReason = EndReason(2);
export const ABANDONED: EndReason = EndReason(3);

// Engine GameResult + EndReason for display.
export interface GameOutcome extends GameResult {
  reason: EndReason;
}

export const GameOutcome = {
  /**
   * Rebuilds the nested GameOutcome shape from a flat GameSnapshot's
   * outcome fields. The single place that knows the flat ↔ nested mapping,
   * so events that still want a nested `GameOutcome` (e.g. MOVE_MADE,
   * GAME_ENDED) don't each hand-roll it from snapshot fields.
   */
  fromSnapshot(snapshot: GameSnapshot): GameOutcome {
    return {
      status: snapshot.resultStatus,
      winner: snapshot.winner,
      hasWinner: snapshot.hasWinner,
      drawReason: snapshot.drawReason,
      reason: snapshot.endReason,
    };
  },
};

// Clock state sent with snapshots; not the engine's Clock class.
export interface ClockState {
  whiteMs: number;
  blackMs: number;
  active: PieceColor | null;
}

// Full serializable game state — sent only on join, sync, and undo.
// Flat by design: consumers (frontend, logs, tests) shouldn't have to
// destructure a nested `result` object just to read `winner` or `status`.
export interface GameSnapshot {
  // Room lifecycle — WAITING (needs an opponent) / ACTIVE (in play) /
  // FINISHED (game over). Distinct from `resultStatus` below, which
  // describes the chess position, not the room.
  status: Lifecycle;
  fen: string;
  turn: PieceColor;
  isCheck: boolean;
  // Flattened GameOutcome fields (was: result: GameOutcome). `winner` is
  // only meaningful when `hasWinner` is true — same contract as GameResult.
  resultStatus: GameStatus;
  winner: PieceColor;
  hasWinner: boolean;
  drawReason: DrawReason;
  endReason: EndReason;
  history: string[];
  capturedByWhite: PieceType[];
  capturedByBlack: PieceType[];
}

// Client → server move input.
export interface MoveInput {
  from: Position;
  to: Position;
  promoteTo?: PieceType;
}

// Client → server join input.
export interface JoinInput {
  roomId?: string;
  mode: Mode;
  color?: PieceColor;
  difficulty?: Difficulty;
}

// Whether a color slot is filled by a person or a computer opponent.
const OccupantKind = brandedTag<"OccupantKind">();

export const HUMAN = OccupantKind("human");
export const AI = OccupantKind("ai");

export type OccupantKind = typeof HUMAN | typeof AI;

// Minimal structural WebSocket shape — matches Elysia's ElysiaWS without importing it.
export interface WebSocket {
  readonly id: string;
  readonly readyState: number;
  send(data: string): void;
  close(): void;
}

// readyState value meaning the socket is open and can send.
export const WS_OPEN = 1;

/**
 * Returns a constructor that brands string literals under a given tag.
 * Used for type-safe discriminant constants
 */
export function brandedTag<Tag extends string>() {
  return function make<T extends string>(value: T): Brand<T, Tag> {
    return value as Brand<T, Tag>;
  };
}
