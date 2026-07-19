import { CHESS_THEMES, DEFAULT_CHESS_THEME } from "@/core/theme"

export const STORAGE_KEY = "chess-theme"

const validIds = new Set(CHESS_THEMES.map((t) => t.id))
const listeners = new Set<() => void>()
let currentTheme = DEFAULT_CHESS_THEME

export const themeStore = {
  subscribe(callback: () => void) {
    listeners.add(callback)
    return () => listeners.delete(callback)
  },

  getSnapshot() {
    return currentTheme
  },

  getServerSnapshot() {
    return DEFAULT_CHESS_THEME
  },

  isValid(id: string | null): id is string {
    return id !== null && validIds.has(id)
  },

  update(id: string) {
    currentTheme = this.isValid(id) ? id : DEFAULT_CHESS_THEME
    localStorage.setItem(STORAGE_KEY, currentTheme)
    listeners.forEach((notify) => notify())
  },

  syncFromStorage() {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (this.isValid(stored) && stored !== currentTheme) {
      currentTheme = stored
      listeners.forEach((notify) => notify())
    }
  },
}
