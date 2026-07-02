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
