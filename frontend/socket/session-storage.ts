const STORAGE_KEY = "chess:session-token"

// An opaque token used to resume a session after reconnect. Guarded for
// SSR — this module is imported by a Client Component, but Next still
// renders it once on the server, where `window` doesn't exist.

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // Storage disabled/unavailable (private browsing, etc.) — degrade to
    // no persistence rather than throwing.
    return null
  }
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, token)
  } catch {
    // Ignore — worst case the next reload starts a fresh session.
  }
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore.
  }
}
