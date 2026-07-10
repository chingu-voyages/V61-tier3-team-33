"use client"

import { createContext, use } from "react"
import type { SettingsState } from "./settings-reducer"

export interface SettingsContextValue {
  state: SettingsState
  goToSection: (id: string) => void
  goBackToList: () => void
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)

export function useSettingsContext(): SettingsContextValue {
  const context = use(SettingsContext)
  if (context === null) {
    throw new Error("useSettingsContext must be used within a SettingsProvider")
  }
  return context
}
