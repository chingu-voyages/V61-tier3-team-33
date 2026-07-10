export type TimeControl =
    | { mode: "timed"; minutes: number; seconds: number; ms?: number }
    | { mode: "async" }
