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

export type MoveError =
  "not-your-turn" | "illegal-move" | "game-over" | "square-empty"

/** Distinct from MoveError — selecting is read-only over any square. */
export type SelectError =
  "not-your-turn" | "game-over" | "square-empty" | "not-your-piece"
