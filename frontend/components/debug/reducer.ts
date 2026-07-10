export const MAX_LOG_ENTRIES = 50

export type LogDirection = "in" | "out"

export interface LogEntry {
  id: number
  direction: LogDirection
  data: unknown
  at: number
}

export type LogAction =
  { type: "LOG"; direction: LogDirection; data: unknown } | { type: "CLEAR" }

let nextId = 0

export function logReducer(state: LogEntry[], action: LogAction): LogEntry[] {
  switch (action.type) {
    case "LOG":
      return [
        {
          id: nextId++,
          direction: action.direction,
          data: action.data,
          at: Date.now(),
        },
        ...state,
      ].slice(0, MAX_LOG_ENTRIES)

    case "CLEAR":
      return []
  }
}
