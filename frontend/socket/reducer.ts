export const CONNECTING = "connecting" as const
export const OPEN = "open" as const
export const RECONNECTING = "reconnecting" as const
export const CLOSED = "closed" as const
export const FAILED = "failed" as const

export type SocketStatus =
  | typeof CONNECTING
  | typeof RECONNECTING
  | typeof OPEN
  | typeof CLOSED
  | typeof FAILED

export interface SocketState {
  status: SocketStatus
  prevStatus: SocketStatus | null
  attempt: number
  disconnectedAt: number | null
}

export const initialSocketState: SocketState = {
  status: "connecting",
  prevStatus: null,
  attempt: 0,
  disconnectedAt: null,
}

export type SocketAction =
  | { type: "OPENED" }
  | { type: "CLOSED"; now: number; maxDisconnectedMs: number }
  | { type: "MANUAL_RECONNECT" }

export function reducer(state: SocketState, action: SocketAction): SocketState {
  switch (action.type) {
    case "OPENED":
      return {
        status: "open",
        prevStatus: state.status,
        attempt: 0,
        disconnectedAt: null,
      }

    case "CLOSED": {
      const disconnectedAt = state.disconnectedAt ?? action.now
      const elapsed = action.now - disconnectedAt

      if (elapsed >= action.maxDisconnectedMs) {
        return {
          status: "failed",
          prevStatus: state.status,
          attempt: state.attempt,
          disconnectedAt,
        }
      }

      return {
        status: "reconnecting",
        prevStatus: state.status,
        attempt: state.attempt + 1,
        disconnectedAt,
      }
    }

    case "MANUAL_RECONNECT":
      return {
        status: "connecting",
        prevStatus: state.status,
        attempt: 0,
        disconnectedAt: null,
      }
  }
}
