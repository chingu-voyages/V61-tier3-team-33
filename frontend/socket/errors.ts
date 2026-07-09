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

export interface ErrorReply {
  type: typeof SESSION_ERROR
  code: ErrorCode
  message: string
}

export type MoveError =
  "not-your-turn" | "illegal-move" | "game-over" | "square-empty"

/** Own union, distinct from MoveError — selecting is a read-only query
 * over any square, not an attempted move over a from/to pair. */
export type SelectError =
  "not-your-turn" | "game-over" | "square-empty" | "not-your-piece"
