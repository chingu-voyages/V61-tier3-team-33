"use client"

import { useState } from "react"
import { GameClock } from "@/components/game-clock"
import { TimeControlSelector } from "@/components/time-control-selector"
import type { TimeControl } from "@/types/clock"

export default function Page() {
    const [timeControl, setTimeControl] = useState<TimeControl | null>(null)
    const [turn, setTurn]               = useState<"white" | "black">("white")
    const [whiteMs, setWhiteMs]         = useState<number | null>(null)
    const [blackMs, setBlackMs]         = useState<number | null>(null)
    const [started, setStarted]         = useState(false)
    const [winner, setWinner]           = useState<string | null>(null)
    const [whiteKey, setWhiteKey]       = useState(0)
    const [blackKey, setBlackKey]       = useState(0)

    function toMs(tc: TimeControl): number | null {
        if (tc.mode === "async") return null
        return (tc.minutes * 60 + tc.seconds) * 1000 + (tc.ms ?? 0)
    }

    function handleSelectTime(tc: TimeControl) {
        setTimeControl(tc)
        const ms = toMs(tc)
        setWhiteMs(ms)
        setBlackMs(ms)
        setTurn("white")
        setStarted(true)
        setWinner(null)
    }

    function handleMove(player: "white" | "black") {
        if (winner || turn !== player) return
        const ms = timeControl ? toMs(timeControl) : null
        if (player === "white") {
            setBlackMs(ms)
            setBlackKey(k => k + 1)
            setTurn("black")
        } else {
            setWhiteMs(ms)
            setWhiteKey(k => k + 1)
            setTurn("white")
        }
    }

    function reset() {
        const ms = timeControl ? toMs(timeControl) : null
        setWhiteMs(ms)
        setBlackMs(ms)
        setTurn("white")
        setStarted(false)
        setWinner(null)
    }

    const isAsync = timeControl?.mode === "async"

    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-8 p-6">
            <h1 className="text-2xl font-bold">Game Clock — CC-5</h1>

            <TimeControlSelector onSelect={handleSelectTime} />

            {timeControl && (
                <>
                    {winner && (
                        <p className="text-destructive font-bold text-lg">{winner} ran out of time!</p>
                    )}

                    {isAsync && !winner && (
                        <p className="text-sm text-muted-foreground">Async mode — no countdown (5 min inactivity rule is server-side)</p>
                    )}

                    <div className="flex gap-12">
                        <div className="flex flex-col items-center gap-2">
                            <span className={`text-sm font-medium ${turn === "white" && started && !winner ? "text-primary" : "text-muted-foreground"}`}>
                                White {turn === "white" && started && !winner ? "▶" : ""}
                            </span>
                            <GameClock
                                key={whiteKey}
                                initialMs={whiteMs}
                                isRunning={!isAsync && started && !winner && turn === "white"}
                                onExpire={() => setWinner("White")}
                            />
                            <button
                                onClick={() => handleMove("white")}
                                disabled={!!winner || (started && turn !== "white")}
                                className="rounded-md bg-primary px-4 py-1 text-sm text-primary-foreground disabled:opacity-30"
                            >
                                White moved
                            </button>
                        </div>

                        <div className="flex flex-col items-center gap-2">
                            <span className={`text-sm font-medium ${turn === "black" && started && !winner ? "text-primary" : "text-muted-foreground"}`}>
                                Black {turn === "black" && started && !winner ? "▶" : ""}
                            </span>
                            <GameClock
                                key={blackKey}
                                initialMs={blackMs}
                                isRunning={!isAsync && started && !winner && turn === "black"}
                                onExpire={() => setWinner("Black")}
                            />
                            <button
                                onClick={() => handleMove("black")}
                                disabled={!!winner || !started || turn !== "black"}
                                className="rounded-md bg-secondary px-4 py-1 text-sm text-secondary-foreground disabled:opacity-30"
                            >
                                Black moved
                            </button>
                        </div>
                    </div>

                    <button onClick={reset} className="text-sm text-muted-foreground underline">
                        Reset
                    </button>
                </>
            )}
        </div>
    )
}
