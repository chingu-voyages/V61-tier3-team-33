import { memo } from "react"
import { DEFAULT_CHESS_THEME } from "@/core/theme"
import { STORAGE_KEY } from "./theme-store"

// Runs inline before hydration to avoid a flash of the default theme.
// Serialized via toString(), so it must be self-contained (no closures).
function applyStoredTheme(storageKey: string, defaultTheme: string) {
  try {
    const stored = localStorage.getItem(storageKey) || defaultTheme
    document.documentElement.setAttribute("data-chess-theme", stored)
  } catch {}
}

export const ChessThemeScript = memo(function ChessThemeScript({
  nonce,
}: {
  nonce?: string
}) {
  const args = JSON.stringify([STORAGE_KEY, DEFAULT_CHESS_THEME]).slice(1, -1)
  return (
    <script
      suppressHydrationWarning
      nonce={typeof window === "undefined" ? nonce : ""}
      dangerouslySetInnerHTML={{
        __html: `(${applyStoredTheme.toString()})(${args})`,
      }}
    />
  )
})
