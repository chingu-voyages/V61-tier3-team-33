"use client"

import { useState, useCallback, useEffect } from "react"

const EMOTES = ["👍", "😅", "🤔", "🎉", "😤", "⚡"]
const COOLDOWN_MS = 7_000

interface EmoteTrayProps {
  onSend: (emote: string) => void
}

export function EmoteTray({ onSend }: EmoteTrayProps) {
  const [cooldownUntil, setCooldownUntil] = useState<number>(0)
  const [open, setOpen] = useState(false)
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (cooldownUntil <= 0) return
    const calc = () =>
      Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000))
    const id = setInterval(() => setRemaining(calc()), 1000)
    return () => clearInterval(id)
  }, [cooldownUntil])

  const onCooldown = remaining > 0

  const handleSend = useCallback(
    (emote: string) => {
      if (onCooldown) return
      onSend(emote)
      setCooldownUntil(Date.now() + COOLDOWN_MS)
      setRemaining(Math.ceil(COOLDOWN_MS / 1000))
      setOpen(false)
    },
    [onCooldown, onSend]
  )

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-accent disabled:opacity-50"
        disabled={onCooldown}
        title={onCooldown ? `Wait ${remaining}s` : "Send reaction"}
      >
        <span>😊</span>
        {onCooldown && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {remaining}s
          </span>
        )}
      </button>

      {open && !onCooldown && (
        <div className="absolute bottom-full left-0 z-20 mb-2 flex gap-1.5 rounded-xl border border-border bg-card p-2 shadow-lg">
          {EMOTES.map((emote) => (
            <button
              key={emote}
              onClick={() => handleSend(emote)}
              className="rounded-md p-1 text-xl transition-transform hover:scale-125 hover:bg-accent active:scale-110"
              title={emote}
            >
              {emote}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
