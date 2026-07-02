export const SESSION_ERROR = "session:error" as const;

export const INVALID_PAYLOAD = "invalid-payload" as const;
export const NOT_IMPLEMENTED = "not-implemented" as const;
export const NOT_AUTHENTICATED = "not-authenticated" as const;
export const NOT_IN_GAME = "not-in-game" as const;
export const ROOM_NOT_FOUND = "room-not-found" as const;
export const GAME_FULL = "game-full" as const;
export const GAME_FINISHED = "game-finished" as const;
export const INTERNAL_ERROR = "internal-error" as const;

export type ErrorCode =
  | typeof INVALID_PAYLOAD
  | typeof NOT_IMPLEMENTED
  | typeof NOT_AUTHENTICATED
  | typeof NOT_IN_GAME
  | typeof ROOM_NOT_FOUND
  | typeof GAME_FULL
  | typeof GAME_FINISHED
  | typeof INTERNAL_ERROR;
