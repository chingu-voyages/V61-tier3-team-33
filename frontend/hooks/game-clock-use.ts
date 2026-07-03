"use client"

import { useEffect, useState } from "react"

export function useGameClock(initialMs: number | null, isRunning: boolean) {
    const [prevInitialMs, setPrevInitialMs] = useState<number | null>(initialMs)
    const [timeMs, setTimeMs] = useState<number | null>(initialMs)

    if (prevInitialMs !== initialMs) {
        setPrevInitialMs(initialMs)
        setTimeMs(initialMs)
    }

    useEffect(() => {
        if (!isRunning) return

        const interval = setInterval(() => {
            setTimeMs(prev => {
                if (prev === null || prev <= 0) return 0
                return prev - 100
            })
        }, 100)

        return () => clearInterval(interval)
    }, [isRunning])

    return timeMs
}
