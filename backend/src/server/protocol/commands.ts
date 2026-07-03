import type { JoinInput, MoveInput, Position } from "../domain/types";

// What the client asks the server to do. One-directional: client → server only.
// Decoded once by Protocol.decode; never sent back out, never passed through Hub.

// Routed to Connections
export const SESSION_HANDSHAKE = "session:handshake" as const;
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

// The click-a-piece step before move:make — routed to GameService, answered
// with position:accept (legal destinations) or position:reject.
export const POSITION_SELECT = "position:select" as const;

export type Command =
  | { type: typeof SESSION_HANDSHAKE; token?: string }
  | { type: typeof SESSION_PONG }
  | ({ type: typeof ROOM_JOIN } & JoinInput)
  | { type: typeof ROOM_LEAVE }
  | ({ type: typeof MOVE_MAKE } & MoveInput)
  | { type: typeof UNDO_REQUEST }
  | { type: typeof UNDO_ACCEPT }
  | { type: typeof UNDO_DECLINE }
  | { type: typeof GAME_RESIGN }
  | { type: typeof STATE_SYNC }
  | { type: typeof POSITION_SELECT; position: Position };
