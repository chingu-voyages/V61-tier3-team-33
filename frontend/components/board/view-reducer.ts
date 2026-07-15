export type ViewState = {
  flipped: boolean
  showResign: boolean
  showUndoConfirm: boolean
  agreedToUndoTerms: boolean
  agreedToOpponentUndoTerms: boolean
}

export type ViewAction =
  | { type: "FLIP" }
  | { type: "SHOW_RESIGN" }
  | { type: "HIDE_RESIGN" }
  | { type: "SHOW_UNDO_CONFIRM" }
  | { type: "HIDE_UNDO_CONFIRM" }
  | { type: "AGREE_TO_UNDO_TERMS"; value: boolean }
  | { type: "AGREE_TO_OPPONENT_UNDO_TERMS"; value: boolean }
  | { type: "RESET_OPPONENT_AGREEMENT" }

export const initialViewState: ViewState = {
  flipped: false,
  showResign: false,
  showUndoConfirm: false,
  agreedToUndoTerms: false,
  agreedToOpponentUndoTerms: false,
}

export function viewReducer(state: ViewState, action: ViewAction): ViewState {
  switch (action.type) {
    case "FLIP":
      return { ...state, flipped: !state.flipped }
    case "SHOW_RESIGN":
      return { ...state, showResign: true }
    case "HIDE_RESIGN":
      return { ...state, showResign: false }
    case "SHOW_UNDO_CONFIRM":
      return { ...state, showUndoConfirm: true }
    case "HIDE_UNDO_CONFIRM":
      return { ...state, showUndoConfirm: false }
    case "AGREE_TO_UNDO_TERMS":
      return { ...state, agreedToUndoTerms: action.value }
    case "AGREE_TO_OPPONENT_UNDO_TERMS":
      return { ...state, agreedToOpponentUndoTerms: action.value }
    case "RESET_OPPONENT_AGREEMENT":
      return { ...state, agreedToOpponentUndoTerms: false }
  }
}
