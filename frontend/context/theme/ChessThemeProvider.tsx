"use client"

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
  use,
  type ReactNode,
} from "react"
import { ChessThemeScript } from "./ChessThemeScript"
import { themeStore } from "./theme-store"

interface ChessThemeContextValue {
  chessTheme: string
  setChessTheme: (id: string) => void
}

const ChessThemeContext = createContext<ChessThemeContextValue | null>(null)

export function useChessTheme(): ChessThemeContextValue {
  const context = use(ChessThemeContext)
  if (context === null) {
    throw new Error("useChessTheme must be used within a ChessThemeProvider")
  }
  return context
}

export function ChessThemeProvider({
  children,
  nonce,
}: {
  children: ReactNode
  nonce?: string
}) {
  const chessTheme = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot
  )

  useEffect(() => {
    themeStore.syncFromStorage()
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute("data-chess-theme", chessTheme)
  }, [chessTheme])

  const setChessTheme = useCallback((id: string) => {
    themeStore.update(id)
  }, [])

  const value = useMemo<ChessThemeContextValue>(
    () => ({ chessTheme, setChessTheme }),
    [chessTheme, setChessTheme]
  )

  return (
    <ChessThemeContext.Provider value={value}>
      <ChessThemeScript nonce={nonce} />
      {children}
    </ChessThemeContext.Provider>
  )
}
