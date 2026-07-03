"use client"

import { useEffect, useRef, useState } from "react"

export function useGameClock(initialMs: number | null, isRunning: boolean) {
    const [timeMs, setTimeMs] = useState<number | null>(initialMs)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        setTimeMs(initialMs)
    }, [initialMs])

    useEffect(() => {
        if (!isRunning || timeMs === null) return

        intervalRef.current = setInterval(() => {
            setTimeMs(prev => {
                if (prev === null || prev <= 0) return 0
                return prev - 100
            })
        }, 100)

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [isRunning])

    return timeMs
}
