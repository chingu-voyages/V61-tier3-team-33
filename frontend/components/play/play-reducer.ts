import type { Phase, PlayMode, TimeControl } from "./types"

export type Action =
  | { type: "CREATE_ROOM"; roomId: string; timeControl: TimeControl }
  | { type: "JOIN_ROOM"; roomId: string; timeControl: TimeControl }
  | { type: "JOIN_FAILED"; mode: PlayMode }
  | { type: "START_SEARCH"; timeControl: TimeControl }
  | { type: "OPPONENT_JOINED" }

export function createInitialPhase({
  mode,
  roomId,
}: {
  mode: PlayMode
  roomId?: string
}): Phase {
  if (roomId) {
    return { phase: "joining", roomId }
  }
  return { phase: "pick-time", mode }
}

export function playReducer(state: Phase, action: Action): Phase {
  switch (action.type) {
    case "CREATE_ROOM":
      return {
        phase: "invite",
        roomId: action.roomId,
        timeControl: action.timeControl,
      }
    case "JOIN_ROOM":
      return {
        phase: "invite",
        roomId: action.roomId,
        timeControl: action.timeControl,
      }
    case "JOIN_FAILED":
      return { phase: "pick-time", mode: action.mode }
    case "START_SEARCH":
      return { phase: "search", timeControl: action.timeControl }
    case "OPPONENT_JOINED":
      return { phase: "play" }
  }
}
