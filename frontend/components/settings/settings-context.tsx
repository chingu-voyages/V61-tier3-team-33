"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react"

type SettingsState = {
  activeSection: string
  mobileView: "list" | "detail"
}

type SettingsAction =
  | { type: "SET_SECTION"; payload: string }
  | { type: "SET_MOBILE_VIEW"; payload: "list" | "detail" }

function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case "SET_SECTION":
      return { ...state, activeSection: action.payload }
    case "SET_MOBILE_VIEW":
      return { ...state, mobileView: action.payload }
    default:
      return state
  }
}

type SettingsContextValue = {
  state: SettingsState
  goToSection: (id: string) => void
  goBackToList: () => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function useSettingsContext() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error("useSettingsContext must be used within a SettingsProvider")
  }
  return context
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(settingsReducer, {
    activeSection: "profile",
    mobileView: "list",
  })

  const goToSection = useCallback((id: string) => {
    dispatch({ type: "SET_SECTION", payload: id })
    dispatch({ type: "SET_MOBILE_VIEW", payload: "detail" })
  }, [])

  const goBackToList = useCallback(() => {
    dispatch({ type: "SET_MOBILE_VIEW", payload: "list" })
  }, [])

  const value = useMemo<SettingsContextValue>(
    () => ({ state, goToSection, goBackToList }),
    [state, goToSection, goBackToList]
  )

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}
