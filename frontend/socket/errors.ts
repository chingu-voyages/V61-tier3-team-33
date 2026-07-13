export const SESSION_ERROR = "session:error" as const

export type ErrorCode =
  | "invalid-payload"
  | "not-implemented"
  | "not-authenticated"
  | "not-in-game"
  | "room-not-found"
  | "game-full"
  | "game-finished"
  | "internal-error"
  | "no-history"
  | "pending-conflict"
  | "not-allowed"
  | "not-your-turn"
  | "game-not-found"

export interface ErrorReply {
  type: typeof SESSION_ERROR
  code: ErrorCode
  message: string
}

export const TOKEN_INVALID_CODES: ReadonlySet<ErrorCode> = new Set([
  "not-authenticated",
  "invalid-payload",
])

export const SESSION_FATAL_CODES: ReadonlySet<ErrorCode> = new Set([
  "not-authenticated",
  "invalid-payload",
  "internal-error",
])

export const ROOM_RESET_CODES: ReadonlySet<ErrorCode> = new Set([
  "not-in-game",
  "room-not-found",
])

export const UNDO_ERROR_MESSAGES: Partial<Record<ErrorCode, string>> = {
  "no-history": "There's no move to undo yet",
  "pending-conflict": "There's already a pending undo request",
  "not-allowed": "Undo isn't allowed right now",
  "not-your-turn": "It's not your turn to request an undo",
  "game-not-found": "This game no longer exists",
}

export type MoveError =
  "not-your-turn" | "illegal-move" | "game-over" | "square-empty"

/** Distinct from MoveError — selecting is read-only over any square. */
export type SelectError =
  "not-your-turn" | "game-over" | "square-empty" | "not-your-piece"
