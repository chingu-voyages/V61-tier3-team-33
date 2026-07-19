export interface ChessTheme {
  id: string
  label: string
}

export const CHESS_THEMES: ChessTheme[] = [
  { id: "walnut", label: "Walnut" },
  { id: "forest", label: "Forest" },
  { id: "ocean", label: "Ocean" },
  { id: "rose", label: "Rose" },
  { id: "slate", label: "Slate" },
  { id: "midnight", label: "Midnight" },
]

export const DEFAULT_CHESS_THEME = "walnut"
