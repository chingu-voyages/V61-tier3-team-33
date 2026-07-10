"use client"

import { useEffect, useState } from "react"

interface EmoteOverlayProps {
  emote: string
}

export function EmoteOverlay({ emote }: EmoteOverlayProps) {
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setFading(true), 3300)
    return () => clearTimeout(id)
  }, [])

  return (
    <>
      <style>{`
        @keyframes emote-pop {
          0%   { transform: scale(0) rotate(-10deg); opacity: 0; }
          60%  { transform: scale(1.35) rotate(5deg); opacity: 1; }
          80%  { transform: scale(0.9) rotate(-2deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes emote-idle {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.08); }
        }
        @keyframes emote-out {
          0%   { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.3); opacity: 0; }
        }
      `}</style>
      <span
        className="inline-block text-5xl drop-shadow-lg select-none pointer-events-none"
        style={{
          animation: fading
            ? "emote-out 0.4s ease-in forwards"
            : "emote-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards, emote-idle 1.5s ease-in-out 0.5s infinite",
        }}
      >
        {emote}
      </span>
    </>
  )
}
