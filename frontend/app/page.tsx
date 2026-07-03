"use client"

import { useState } from "react"
import { GameClock } from "@/components/game-clock"
import { TimeControlSelector } from "@/components/time-control-selector"
import type { TimeControl } from "@/types/clock"

export default function Page() {
    const [timeControl, setTimeControl] = useState<TimeControl | null>(null)
    const [started, setStarted] = useState(false)
    const [turn, setTurn] = useState<"white" | "black">("white")
    const [whiteMs, setWhiteMs] = useState<number | null>(null)
    const [blackMs, setBlackMs] = useState<number | null>(null)

    function handleSelect(tc: TimeControl) {
        setTimeControl(tc)
        setStarted(false)
        setTurn("white")
        if (tc.mode === "timed") {
            const total = (tc.minutes * 60 + tc.seconds) * 1000
            setWhiteMs(total)
            setBlackMs(total)
        } else {
            setWhiteMs(null)
            setBlackMs(null)
        }
    }

    function handleStart() {
        if (!timeControl) return
        setStarted(true)
    }

    function switchTurn() {
        setTurn(t => t === "white" ? "black" : "white")
    }

    const showMs = timeControl?.mode === "timed" && timeControl.ms !== undefined

    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-8 p-6">
            <h1 className="text-2xl font-bold">Game Clock — CC-5</h1>

            <TimeControlSelector onSelect={handleSelect} />

            {timeControl && (
                <div className="flex flex-col items-center gap-6">
                    <div className="flex gap-12">
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-sm text-muted-foreground">Black</span>
                            <GameClock
                                initialMs={blackMs}
                                isRunning={started && turn === "black"}
                                showMs={showMs}
                                onExpire={() => alert("Black ran out of time!")}
                            />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-sm text-muted-foreground">White</span>
                            <GameClock
                                initialMs={whiteMs}
                                isRunning={started && turn === "white"}
                                showMs={showMs}
                                onExpire={() => alert("White ran out of time!")}
                            />
                        </div>
                    </div>

                    {!started ? (
                        <button
                            onClick={handleStart}
                            className="rounded-md bg-primary px-6 py-2 text-primary-foreground"
                        >
                            Démarrer
                        </button>
                    ) : (
                        <button
                            onClick={switchTurn}
                            className="rounded-md bg-secondary px-6 py-2 text-secondary-foreground"
                        >
                            Coup joué →
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
