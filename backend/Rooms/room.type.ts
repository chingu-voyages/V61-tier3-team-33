export type User={
    id:string,
    ws:any
}
export type Room={
    id:string,
   players:string[],
   gameStatus:"active"|"over"|"waiting"
}

export type TimeControl = 
    | { mode: "timed"; minutes: number; seconds: number; ms?: number }
    | { mode: "async" }

export type ClockState = {
    whitePlayerTimeMs: number | null
    blackPlayerTimeMs: number | null
    timeControl: TimeControl | null
}