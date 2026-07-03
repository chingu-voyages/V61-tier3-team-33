import { getStoredToken } from "@/socket/session-storage"

export type SessionStatus =
  "idle" | "authenticating" | "authenticated" | "error"

export interface SessionState {
  status: SessionStatus
  playerId: string | null
  token: string | null
  error: { code: string; message: string } | null
}

export const initialSessionState: SessionState = {
  status: "idle",
  playerId: null,
  token: null,
  error: null,
}

/** Lazy useReducer initializer — seeds `token` from localStorage so a
 * reload can resume the prior session instead of always starting fresh. */
export function createInitialSessionState(): SessionState {
  return { ...initialSessionState, token: getStoredToken() }
}

export type SessionAction =
  | { type: "HANDSHAKE_SENT" }
  | { type: "HANDSHAKE_OK"; playerId: string; token: string }
  | { type: "HANDSHAKE_ERROR"; code: string; message: string }

export function sessionReducer(
  state: SessionState,
  action: SessionAction
): SessionState {
  switch (action.type) {
    case "HANDSHAKE_SENT":
      return { ...state, status: "authenticating" }
    case "HANDSHAKE_OK":
      return {
        status: "authenticated",
        playerId: action.playerId,
        token: action.token,
        error: null,
      }
    case "HANDSHAKE_ERROR":
      return {
        ...state,
        status: "error",
        error: { code: action.code, message: action.message },
      }
  }
}
