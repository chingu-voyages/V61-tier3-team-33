import type { JoinInput, MoveInput } from "../domain/types";

// What the client asks the server to do. One-directional: client → server only.
// Decoded once by Protocol.decode; never sent back out, never passed through Hub.

// Routed to Connections
export const SESSION_HELLO = "session:hello" as const;
export const SESSION_PONG = "session:pong" as const;

// Routed to GameService
export const ROOM_JOIN = "room:join" as const;
export const ROOM_LEAVE = "room:leave" as const;

// Routed to Moves via GameService
export const MOVE_MAKE = "move:make" as const;
export const UNDO_REQUEST = "undo:request" as const;
export const UNDO_ACCEPT = "undo:accept" as const;
export const UNDO_DECLINE = "undo:decline" as const;
export const GAME_RESIGN = "game:resign" as const;
export const STATE_SYNC = "state:sync" as const;

export type Command =
  | { type: typeof SESSION_HELLO; token?: string }
  | { type: typeof SESSION_PONG }
  | ({ type: typeof ROOM_JOIN } & JoinInput)
  | { type: typeof ROOM_LEAVE }
  | ({ type: typeof MOVE_MAKE } & MoveInput)
  | { type: typeof UNDO_REQUEST }
  | { type: typeof UNDO_ACCEPT }
  | { type: typeof UNDO_DECLINE }
  | { type: typeof GAME_RESIGN }
  | { type: typeof STATE_SYNC };
