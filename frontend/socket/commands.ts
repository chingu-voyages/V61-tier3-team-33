import { JoinInput, MoveInput, SelectInput } from "./types"

// Server-bound commands
export const SESSION_HANDSHAKE = "session:handshake" as const
export const SESSION_PONG = "session:pong" as const
export const ROOM_JOIN = "room:join" as const
export const ROOM_LEAVE = "room:leave" as const
export const MOVE_MAKE = "move:make" as const
export const UNDO_REQUEST = "undo:request" as const
export const UNDO_ACCEPT = "undo:accept" as const
export const UNDO_DECLINE = "undo:decline" as const
export const UNDO_CANCEL = "undo:cancel" as const
export const GAME_RESIGN = "game:resign" as const
export const STATE_SYNC = "state:sync" as const
export const POSITION_SELECT = "position:select" as const

export type Command =
  | { type: typeof SESSION_HANDSHAKE; token?: string }
  | { type: typeof SESSION_PONG }
  | ({ type: typeof ROOM_JOIN } & JoinInput)
  | { type: typeof ROOM_LEAVE }
  | ({ type: typeof MOVE_MAKE } & MoveInput)
  | { type: typeof UNDO_REQUEST }
  | { type: typeof UNDO_ACCEPT }
  | { type: typeof UNDO_DECLINE }
  | { type: typeof UNDO_CANCEL }
  | { type: typeof GAME_RESIGN }
  | { type: typeof STATE_SYNC }
  | ({ type: typeof POSITION_SELECT } & SelectInput)

// Typed builders — type-safe, no raw object literals.
export const Commands = {
  handshake(token?: string): Command {
    return token
      ? { type: SESSION_HANDSHAKE, token }
      : { type: SESSION_HANDSHAKE }
  },
  pong(): Command {
    return { type: SESSION_PONG }
  },
  joinRoom(input: JoinInput): Command {
    return { type: ROOM_JOIN, ...input }
  },
  leaveRoom(): Command {
    return { type: ROOM_LEAVE }
  },
  makeMove(input: MoveInput): Command {
    return { type: MOVE_MAKE, ...input }
  },
  requestUndo(): Command {
    return { type: UNDO_REQUEST }
  },
  acceptUndo(): Command {
    return { type: UNDO_ACCEPT }
  },
  declineUndo(): Command {
    return { type: UNDO_DECLINE }
  },
  cancelUndo(): Command {
    return { type: UNDO_CANCEL }
  },
  resign(): Command {
    return { type: GAME_RESIGN }
  },
  syncState(): Command {
    return { type: STATE_SYNC }
  },
  selectPosition(input: SelectInput): Command {
    return { type: POSITION_SELECT, ...input }
  },
}
