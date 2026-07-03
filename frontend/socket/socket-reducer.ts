export type SocketStatus =
  "connecting" | "open" | "closed" | "reconnecting" | "failed"

export interface SocketState {
  status: SocketStatus
  attempt: number
  disconnectedAt: number | null
}

export type SocketAction =
  | { type: "OPENED" }
  | { type: "CLOSED"; now: number; maxDisconnectedMs: number }
  | { type: "MANUAL_RECONNECT" }

export const initialSocketState: SocketState = {
  status: "connecting",
  attempt: 0,
  disconnectedAt: null,
}

export function socketReducer(
  state: SocketState,
  action: SocketAction
): SocketState {
  switch (action.type) {
    case "OPENED":
      return { status: "open", attempt: 0, disconnectedAt: null }

    case "CLOSED": {
      // First drop starts the clock; later drops keep the original
      // timestamp, so elapsed time is measured from when connectivity
      // was actually lost.
      const disconnectedAt = state.disconnectedAt ?? action.now
      const elapsed = action.now - disconnectedAt

      if (elapsed >= action.maxDisconnectedMs) {
        return { status: "failed", attempt: state.attempt, disconnectedAt }
      }

      return {
        status: "reconnecting",
        attempt: state.attempt + 1,
        disconnectedAt,
      }
    }

    case "MANUAL_RECONNECT":
      // Only meaningful from "failed" — enforced by SocketClient.reconnect,
      // not here, since the reducer shouldn't reject actions silently.
      return { status: "connecting", attempt: 0, disconnectedAt: null }
  }
}
