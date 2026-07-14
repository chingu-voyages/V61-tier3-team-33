import { brandedTag } from "./chess";

// Result type (ok / err)

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T = void>(value?: T): Result<T, never> {
  return { ok: true, value: value as T };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// RoomError — room-level issues (joining, leaving, not-in-room)

const RoomError = brandedTag<"RoomError">();

export const ROOM_FULL = RoomError("room-full");
export const INVALID_MODE = RoomError("invalid-mode");
export const ROOM_NOT_FOUND = RoomError("room-not-found");

export type RoomError = typeof ROOM_FULL | typeof INVALID_MODE | typeof ROOM_NOT_FOUND;

// GameError — gameplay-level issues (moves, undo, selection, etc.)

const GameError = brandedTag<"GameError">();

export const NOT_IN_GAME = GameError("not-in-game");
export const GAME_NOT_FOUND = GameError("game-not-found");
export const GAME_OVER = GameError("game-over");
export const NOT_YOUR_TURN = GameError("not-your-turn");
export const ILLEGAL_MOVE = GameError("illegal-move");
export const SQUARE_EMPTY = GameError("square-empty");
export const NOT_YOUR_PIECE = GameError("not-your-piece");
export const NO_HISTORY = GameError("no-history");
export const PENDING_CONFLICT = GameError("pending-conflict");
export const NOT_ALLOWED = GameError("not-allowed");
export const UNDO_INACTIVE = GameError("undo-inactive");
export const NOT_SEATED = GameError("not-seated");
export const RATE_LIMITED = GameError("rate-limited");

export type GameError =
  | typeof NOT_IN_GAME
  | typeof GAME_NOT_FOUND
  | typeof GAME_OVER
  | typeof NOT_YOUR_TURN
  | typeof ILLEGAL_MOVE
  | typeof SQUARE_EMPTY
  | typeof NOT_YOUR_PIECE
  | typeof NO_HISTORY
  | typeof PENDING_CONFLICT
  | typeof NOT_ALLOWED
  | typeof UNDO_INACTIVE
  | typeof NOT_SEATED
  | typeof RATE_LIMITED;

// StrategyError — engine/strategy issues

const StrategyError = brandedTag<"StrategyError">();

export const ENGINE_UNAVAILABLE = StrategyError("engine-unavailable");
export const NO_LEGAL_MOVES = StrategyError("no-legal-moves");

export type StrategyError = typeof ENGINE_UNAVAILABLE | typeof NO_LEGAL_MOVES;

// CommitError — optimistic-concurrency conflict

const CommitError = brandedTag<"CommitError">();

export const CONFLICT = CommitError("conflict");

export type CommitError = typeof CONFLICT;

// RetryConfigErrorCode — retry config validation

const RetryConfigErrorCode = brandedTag<"RetryConfigErrorCode">();

export const INVALID_MAX_ATTEMPTS = RetryConfigErrorCode("invalid-max-attempts");
export const INVALID_BASE_DELAY = RetryConfigErrorCode("invalid-base-delay");
export const INVALID_MAX_DELAY = RetryConfigErrorCode("invalid-max-delay");

export type RetryConfigErrorCode = typeof INVALID_MAX_ATTEMPTS | typeof INVALID_BASE_DELAY | typeof INVALID_MAX_DELAY;

// Protocol-level error codes (serialised to clients)
// Reuses branded constants above; only protocol-only codes here.

export const SESSION_ERROR = "session:error" as const;
export const INVALID_PAYLOAD = "invalid-payload" as const;
export const NOT_IMPLEMENTED = "not-implemented" as const;
export const NOT_AUTHENTICATED = "not-authenticated" as const;
export const INTERNAL_ERROR = "internal-error" as const;

export type ErrorCode =
  | typeof SESSION_ERROR
  | typeof INVALID_PAYLOAD
  | typeof NOT_IMPLEMENTED
  | typeof NOT_AUTHENTICATED
  | typeof INTERNAL_ERROR
  | RoomError
  | GameError;

export const ErrorMessages: Record<string, string> = {
  [INVALID_PAYLOAD]: "Unparseable or unknown command.",
  [NOT_IMPLEMENTED]: "Command type not implemented.",
  [NOT_AUTHENTICATED]: "Session not found.",
  [ROOM_FULL]: "The room is full.",
  [INVALID_MODE]: "Cannot join in the current game state.",
  [ROOM_NOT_FOUND]: "This invite link is no longer valid — the game may have expired or the host left.",
  [NOT_IN_GAME]: "You are not in a game.",
  [GAME_OVER]: "The game is already over.",
  [GAME_NOT_FOUND]: "That game no longer exists.",
  [NO_HISTORY]: "There's no move to undo.",
  [NOT_YOUR_TURN]: "It's not your turn.",
  [ILLEGAL_MOVE]: "That move is not legal.",
  [SQUARE_EMPTY]: "That square is empty.",
  [NOT_YOUR_PIECE]: "That piece belongs to your opponent.",
  [NO_HISTORY]: "There are no moves to undo.",
  [NOT_ALLOWED]: "Cannot request undo again without a move in between.",
  [UNDO_INACTIVE]: "You cannot undo — the game is not active.",
  [NOT_SEATED]: "You cannot resign — you are not seated in this game.",
  [PENDING_CONFLICT]: "There's already a pending undo request.",
  [RATE_LIMITED]: "Please wait a moment before requesting an undo again.",
  [INTERNAL_ERROR]: "An unexpected error occurred.",
};
