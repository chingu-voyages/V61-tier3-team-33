import type { Position } from "@/core/position"

export interface ViewState {
  selected: Position | null
  legalMoves: Position[]
  lastMove: { from: Position; to: Position } | null
  flipped: boolean
}

export type ViewAction =
  | { type: "ACCEPT_SELECTION"; position: Position; moves: Position[] }
  | { type: "CLEAR_SELECTION" }
  | { type: "MOVE_MADE"; from: Position; to: Position }
  | { type: "FLIP" }

export const INITIAL_VIEW: ViewState = {
  selected: null,
  legalMoves: [],
  lastMove: null,
  flipped: false,
}

export function viewReducer(state: ViewState, action: ViewAction): ViewState {
  switch (action.type) {
    case "ACCEPT_SELECTION":
      return { ...state, selected: action.position, legalMoves: action.moves }
    case "CLEAR_SELECTION":
      return { ...state, selected: null, legalMoves: [] }
    case "MOVE_MADE":
      return {
        ...state,
        selected: null,
        legalMoves: [],
        lastMove: { from: action.from, to: action.to },
      }
    case "FLIP":
      return { ...state, flipped: !state.flipped }
  }
}
