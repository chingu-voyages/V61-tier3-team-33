"use client"

import { useEffect, useState } from "react"

interface EmoteOverlayProps {
  emote: string | null
}

export function EmoteOverlay({ emote }: EmoteOverlayProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const hide = setTimeout(() => setVisible(false), 2000)
    return () => clearTimeout(hide)
  }, [])

  if (!emote) return null

  return (
    <div
      className={[
        "pointer-events-none absolute inset-0 z-30 flex items-center justify-center transition-opacity duration-500",
        visible ? "opacity-100" : "opacity-0",
      ].join(" ")}
    >
      <span className="text-6xl drop-shadow-lg animate-bounce">{emote}</span>
    </div>
  )
}
