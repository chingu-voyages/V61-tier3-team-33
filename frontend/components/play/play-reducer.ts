import type { Phase, PlayMode, TimeControl } from "./types"
import type { PieceColor } from "@/chess/core/piece"

export type Action =
  | { type: "CREATE_ROOM"; timeControl: TimeControl; color?: PieceColor }
  | { type: "ROOM_CREATED"; roomId: string }
  | { type: "CREATE_FAILED" }
  | { type: "JOIN_ROOM"; roomId: string; timeControl: TimeControl; color?: PieceColor }
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
      return { phase: "creating", timeControl: action.timeControl, color: action.color }
    case "ROOM_CREATED":
      if (state.phase !== "creating") return state
      return {
        phase: "invite",
        roomId: action.roomId,
        timeControl: state.timeControl,
        color: state.color,
      }
    case "CREATE_FAILED":
      if (state.phase !== "creating") return state
      return { phase: "pick-time", mode: "friend" }
    case "JOIN_ROOM":
      return {
        phase: "invite",
        roomId: action.roomId,
        timeControl: action.timeControl,
        color: action.color,
      }
    case "JOIN_FAILED":
      return { phase: "pick-time", mode: action.mode }
    case "START_SEARCH":
      return { phase: "search", timeControl: action.timeControl }
    case "OPPONENT_JOINED":
      return { phase: "play" }
  }
}
