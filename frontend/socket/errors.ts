export const SESSION_ERROR = "session:error" as const

export const INVALID_PAYLOAD = "invalid-payload" as const
export const NOT_IMPLEMENTED = "not-implemented" as const
export const NOT_AUTHENTICATED = "not-authenticated" as const
export const NOT_IN_GAME = "not-in-game" as const
export const ROOM_NOT_FOUND = "room-not-found" as const
export const ROOM_FULL = "room-full" as const
export const INVALID_MODE = "invalid-mode" as const
export const INTERNAL_ERROR = "internal-error" as const
export const NO_HISTORY = "no-history" as const
export const PENDING_CONFLICT = "pending-conflict" as const
export const NOT_ALLOWED = "not-allowed" as const
export const NOT_YOUR_TURN = "not-your-turn" as const
export const GAME_NOT_FOUND = "game-not-found" as const
export const UNDO_INACTIVE = "undo-inactive" as const
export const NOT_SEATED = "not-seated" as const
export const RATE_LIMITED = "rate-limited" as const

// Move/select notification error codes (also reachable as session:error codes)
export const ILLEGAL_MOVE = "illegal-move" as const
export const GAME_OVER = "game-over" as const
export const SQUARE_EMPTY = "square-empty" as const
export const NOT_YOUR_PIECE = "not-your-piece" as const

export type ErrorCode =
  | typeof INVALID_PAYLOAD
  | typeof NOT_IMPLEMENTED
  | typeof NOT_AUTHENTICATED
  | typeof NOT_IN_GAME
  | typeof ROOM_NOT_FOUND
  | typeof ROOM_FULL
  | typeof INVALID_MODE
  | typeof INTERNAL_ERROR
  | typeof NO_HISTORY
  | typeof PENDING_CONFLICT
  | typeof NOT_ALLOWED
  | typeof NOT_YOUR_TURN
  | typeof GAME_NOT_FOUND
  | typeof UNDO_INACTIVE
  | typeof NOT_SEATED
  | typeof RATE_LIMITED

export interface ErrorReply {
  type: typeof SESSION_ERROR
  code: ErrorCode
  message: string
}

export const TOKEN_INVALID_CODES: ReadonlySet<ErrorCode> = new Set([
  NOT_AUTHENTICATED,
  INVALID_PAYLOAD,
])

export const SESSION_FATAL_CODES: ReadonlySet<ErrorCode> = new Set([
  NOT_AUTHENTICATED,
  INVALID_PAYLOAD,
  INTERNAL_ERROR,
])

export const ROOM_RESET_CODES: ReadonlySet<ErrorCode> = new Set([
  NOT_IN_GAME,
  ROOM_NOT_FOUND,
  INVALID_MODE,
])

export const UNDO_ERROR_MESSAGES: Partial<Record<ErrorCode, string>> = {
  [NO_HISTORY]: "There are no moves to undo yet",
  [PENDING_CONFLICT]: "There's already a pending undo request",
  [NOT_ALLOWED]: "Cannot request undo again without a move in between",
  [NOT_YOUR_TURN]: "It's not your turn to request an undo",
  [GAME_NOT_FOUND]: "This game no longer exists",
  [UNDO_INACTIVE]: "You cannot undo — the game is not active",
  [NOT_SEATED]: "You cannot resign — you are not seated in this game",
  [RATE_LIMITED]: "Please wait a moment before requesting an undo again",
}

export const ERROR_MESSAGES: Partial<Record<string, string>> = {
  [ROOM_FULL]: "The room is full.",
  [INVALID_MODE]: "Cannot join in the current game state.",
}

export type MoveError =
  | typeof NOT_YOUR_TURN
  | typeof ILLEGAL_MOVE
  | typeof GAME_OVER
  | typeof SQUARE_EMPTY

/** Distinct from MoveError — selecting is read-only over any square. */
export type SelectError =
  | typeof NOT_YOUR_TURN
  | typeof GAME_OVER
  | typeof SQUARE_EMPTY
  | typeof NOT_YOUR_PIECE
