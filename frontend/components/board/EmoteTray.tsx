"use client"

import { useState, useCallback, useEffect } from "react"

const EMOTES = ["👍", "😅", "🤔", "🎉", "😤", "⚡"]
const COOLDOWN_MS = 30_000

interface EmoteTrayProps {
  onSend: (emote: string) => void
}

export function EmoteTray({ onSend }: EmoteTrayProps) {
  const [cooldownUntil, setCooldownUntil] = useState<number>(0)
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [cooldownUntil])

  const remaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
  const onCooldown = remaining > 0

  const handleSend = useCallback((emote: string) => {
    if (onCooldown) return
    onSend(emote)
    setCooldownUntil(Date.now() + COOLDOWN_MS)
    setOpen(false)
  }, [onCooldown, onSend])

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-accent disabled:opacity-50"
        disabled={onCooldown}
        title={onCooldown ? `Wait ${remaining}s` : "Send reaction"}
      >
        <span>😊</span>
        {onCooldown && <span className="tabular-nums text-muted-foreground text-xs">{remaining}s</span>}
      </button>

      {open && !onCooldown && (
        <div className="absolute bottom-full mb-2 left-0 flex gap-1.5 rounded-xl border border-border bg-card p-2 shadow-lg z-20">
          {EMOTES.map(emote => (
            <button
              key={emote}
              onClick={() => handleSend(emote)}
              className="text-xl transition-transform hover:scale-125 active:scale-110 rounded-md p-1 hover:bg-accent"
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
