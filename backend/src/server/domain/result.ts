import { brandedTag, type Brand } from "./types";

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// Construct a success result.
export function ok<T = void>(value?: T): Result<T, never> {
  return { ok: true, value: value as T };
}

// Construct a failure result.
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// MoveError
const MoveError = brandedTag<"MoveError">();

export const NOT_YOUR_TURN = MoveError("not-your-turn");
export const ILLEGAL_MOVE = MoveError("illegal-move");
export const GAME_OVER = MoveError("game-over");
export const SQUARE_EMPTY = MoveError("square-empty");

export type MoveError =
  | typeof NOT_YOUR_TURN
  | typeof ILLEGAL_MOVE
  | typeof GAME_OVER
  | typeof SQUARE_EMPTY;

// UndoError
const UndoError = brandedTag<"UndoError">();

export const NO_HISTORY = UndoError("no-history");
export const PENDING_CONFLICT = UndoError("pending-conflict");
export const NOT_ALLOWED = UndoError("not-allowed");

export type UndoError =
  typeof NO_HISTORY | typeof PENDING_CONFLICT | typeof NOT_ALLOWED;

// JoinError
const JoinError = brandedTag<"JoinError">();

export const ROOM_FULL = JoinError("room-full");
export const INVALID_MODE = JoinError("invalid-mode");

export type JoinError = typeof ROOM_FULL | typeof INVALID_MODE;

// SelectError — position:select (the click-a-piece step before move:make).
// A separate union from MoveError even where the reasons overlap in spirit
// (not-your-turn, game-over): selecting is a read-only query over any
// square on the board, not an attempted move over a from/to pair, so it
// has its own failure shape (e.g. NOT_YOUR_PIECE has no MoveError analog).
const SelectError = brandedTag<"SelectError">();

export const SELECT_GAME_OVER = SelectError("game-over");
export const SELECT_NOT_YOUR_TURN = SelectError("not-your-turn");
export const SELECT_SQUARE_EMPTY = SelectError("square-empty");
export const SELECT_NOT_YOUR_PIECE = SelectError("not-your-piece");

export type SelectError =
  | typeof SELECT_GAME_OVER
  | typeof SELECT_NOT_YOUR_TURN
  | typeof SELECT_SQUARE_EMPTY
  | typeof SELECT_NOT_YOUR_PIECE;

// StrategyError
const StrategyError = brandedTag<"StrategyError">();

export const ENGINE_UNAVAILABLE = StrategyError("engine-unavailable");
export const NO_LEGAL_MOVES = StrategyError("no-legal-moves");

export type StrategyError = typeof ENGINE_UNAVAILABLE | typeof NO_LEGAL_MOVES;

// CommitError
const CommitError = brandedTag<"CommitError">();

export const CONFLICT = CommitError("conflict");

export type CommitError = typeof CONFLICT;

// RetryConfigErrorCode
const RetryConfigErrorCode = brandedTag<"RetryConfigErrorCode">();

export const INVALID_MAX_ATTEMPTS = RetryConfigErrorCode(
  "invalid-max-attempts",
);
export const INVALID_BASE_DELAY = RetryConfigErrorCode("invalid-base-delay");
export const INVALID_MAX_DELAY = RetryConfigErrorCode("invalid-max-delay");

export type RetryConfigErrorCode =
  | typeof INVALID_MAX_ATTEMPTS
  | typeof INVALID_BASE_DELAY
  | typeof INVALID_MAX_DELAY;
