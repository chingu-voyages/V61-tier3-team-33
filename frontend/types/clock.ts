export type TimeControl =
    | { mode: "per_move"; minutes: number; seconds: number; ms?: number }
    | { mode: "async" }
