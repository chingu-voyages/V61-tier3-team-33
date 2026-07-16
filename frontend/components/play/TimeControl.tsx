"use client"

import { useState } from "react"
import { IconUsers, IconWorld, IconColorPicker } from "@tabler/icons-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { TimeControl, PlayMode, ColorChoice } from "./types"
import { DEFAULT_TIME_CONTROLS } from "./time-controls"
import { WHITE, BLACK } from "@/chess/core/piece"

const MODE = {
  friend: {
    title: "Challenge a Friend",
    desc: "Pick a time control, then share the invite link",
    icon: IconUsers,
    action: "Create Room",
  },
  online: {
    title: "Play Online",
    desc: "Pick a time control and find an opponent",
    icon: IconWorld,
    action: "Find Match",
  },
} as const

const COLOR_OPTIONS: { value: ColorChoice; label: string; icon: string }[] = [
  { value: null, label: "Random", icon: "\u2694\uFE0F" },
  { value: WHITE, label: "White", icon: "\u2654" },
  { value: BLACK, label: "Black", icon: "\u265A" },
]

interface Props {
  mode: PlayMode
  open: boolean
  connecting?: boolean
  onPick: (control: TimeControl, color?: ColorChoice) => void
  onCancel: () => void
}

export function TimeControl({
  mode,
  open,
  connecting = false,
  onPick,
  onCancel,
}: Props) {
  const [selected, setSelected] = useState(DEFAULT_TIME_CONTROLS[0]!.id)
  const [colorPref, setColorPref] = useState<ColorChoice>(null)
  const cfg = MODE[mode]

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <cfg.icon className="size-5 text-muted-foreground" />
            <DialogTitle>{cfg.title}</DialogTitle>
          </div>
          <DialogDescription>{cfg.desc}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {DEFAULT_TIME_CONTROLS.map((tc) => (
            <button
              key={tc.id}
              type="button"
              onClick={() => setSelected(tc.id)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                "hover:border-border hover:bg-accent/50",
                selected === tc.id
                  ? "border-foreground/20 bg-accent/30 ring-1 ring-foreground/10"
                  : "border-border/50"
              )}
            >
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg",
                  selected === tc.id
                    ? cn(tc.accent, "bg-white/10")
                    : "bg-muted text-muted-foreground"
                )}
              >
                <tc.icon className="size-5" />
              </div>
              <div className="flex-1">
                <div className="font-medium">{tc.name}</div>
                <div className="text-xs text-muted-foreground">
                  {tc.description}
                </div>
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {tc.initialMs < 60_000
                  ? `${tc.initialMs / 1000}s`
                  : `${tc.initialMs / 60000}min`}
              </div>
            </button>
          ))}
        </div>

        {mode === "friend" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <IconColorPicker className="size-3.5" />
              <span>Your color</span>
            </div>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setColorPref(opt.value)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-sm transition-all",
                    colorPref === opt.value
                      ? "border-foreground/20 bg-accent/30 ring-1 ring-foreground/10"
                      : "border-border/50 hover:border-border hover:bg-accent/50"
                  )}
                >
                  <span className="text-base">{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            disabled={connecting}
            onClick={() => {
              const picked = DEFAULT_TIME_CONTROLS.find(
                (tc) => tc.id === selected
              )
              if (picked) onPick(picked, colorPref)
            }}
          >
            {connecting ? "Connecting\u2026" : cfg.action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
