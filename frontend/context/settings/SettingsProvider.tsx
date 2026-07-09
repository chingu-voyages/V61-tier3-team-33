"use client"

import { useCallback, useMemo, useReducer, type ReactNode } from "react"
import { settingsReducer } from "./settings-reducer"
import { SettingsContext, type SettingsContextValue } from "./settings-context"

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
