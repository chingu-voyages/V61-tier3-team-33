"use client"

import { createContext, use } from "react"

export interface Sound {
  ready: boolean
  prime: () => void
  preload: () => void
  playMove: () => void
  playCapture: () => void
}

export const SoundContext = createContext<Sound | null>(null)

export function useSoundContext(): Sound {
  const context = use(SoundContext)
  if (context === null) {
    throw new Error("useSoundContext must be used within an AudioProvider")
  }
  return context
}
