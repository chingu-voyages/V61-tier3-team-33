"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { TimeControl } from "@/types/clock"

const PRESETS: { label: string; value: TimeControl }[] = [
    { label: "1 min", value: { mode: "per_move", minutes: 1, seconds: 0 } },
    { label: "2 min", value: { mode: "per_move", minutes: 2, seconds: 0 } },
    { label: "3 min", value: { mode: "per_move", minutes: 3, seconds: 0 } },
    { label: "4 min", value: { mode: "per_move", minutes: 4, seconds: 0 } },
    { label: "5 min", value: { mode: "per_move", minutes: 5, seconds: 0 } },
    { label: "Async", value: { mode: "async"                            } },
]

interface Props {
    onSelect: (tc: TimeControl) => void
}

export function TimeControlSelector({ onSelect }: Props) {
    const [selected, setSelected] = useState<TimeControl | null>(null)

    function handleSelect(tc: TimeControl) {
        setSelected(tc)
        onSelect(tc)
    }

    function isActive(tc: TimeControl): boolean {
        if (!selected) return false
        if (tc.mode !== selected.mode) return false
        if (tc.mode === "async") return true
        if (selected.mode === "async") return false
        return tc.minutes === selected.minutes && tc.seconds === selected.seconds
    }

    return (
        <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Choose time control</p>
            <div className="grid grid-cols-3 gap-2">
                {PRESETS.map((preset) => (
                    <Button
                        key={preset.label}
                        variant={isActive(preset.value) ? "default" : "outline"}
                        onClick={() => handleSelect(preset.value)}
                    >
                        {preset.label}
                    </Button>
                ))}
            </div>
        </div>
    )
}
