export interface SettingsState {
  activeSection: string
  mobileView: "list" | "detail"
}

export type SettingsAction =
  | { type: "SET_SECTION"; payload: string }
  | { type: "SET_MOBILE_VIEW"; payload: "list" | "detail" }

export function settingsReducer(
  state: SettingsState,
  action: SettingsAction
): SettingsState {
  switch (action.type) {
    case "SET_SECTION":
      return { ...state, activeSection: action.payload }
    case "SET_MOBILE_VIEW":
      return { ...state, mobileView: action.payload }
    default:
      return state
  }
}
