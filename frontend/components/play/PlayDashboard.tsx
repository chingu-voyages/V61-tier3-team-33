"use client"

import * as React from "react"
import { IconChess, IconDoorEnter, IconRobot, IconUsers } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useGame } from "@/context/use-game"
import { PillGroup, type PillOption } from "./PillGroup"
import {
  EASY,
  MEDIUM,
  HARD,
  HUMAN_VS_AI,
  HUMAN_VS_HUMAN,
  type Difficulty,
  type Mode,
} from "@/socket/commands"
import { WHITE, BLACK, type PieceColor } from "@/lib/core/piece"

const OPPONENT_OPTIONS: PillOption<Mode>[] = [
  {
    value: HUMAN_VS_HUMAN,
    label: (
      <>
        <IconUsers data-icon="inline-start" />
        Human
      </>
    ),
  },
  {
    value: HUMAN_VS_AI,
    label: (
      <>
        <IconRobot data-icon="inline-start" />
        Computer
      </>
    ),
  },
]

const DIFFICULTY_OPTIONS: PillOption<Difficulty>[] = [
  { label: "Easy", value: EASY },
  { label: "Medium", value: MEDIUM },
  { label: "Hard", value: HARD },
]

type ColorChoice = "auto" | PieceColor

const COLOR_OPTIONS: PillOption<ColorChoice>[] = [
  { label: "Auto", value: "auto" },
  { label: "White", value: WHITE },
  { label: "Black", value: BLACK },
]

/**
 * The entry screen for the play flow — shown once the socket is
 * authenticated and the player isn't in a room yet (see
 * derivePlayPhase). Two independent paths, both ending in the same
 * actions.joinRoom() call: configure and start a fresh room, or drop a
 * roomId to join one that already exists.
 */
export function PlayDashboard() {
  const { actions } = useGame()
  const [mode, setMode] = React.useState<Mode>(HUMAN_VS_HUMAN)
  const [difficulty, setDifficulty] = React.useState<Difficulty>(EASY)
  const [color, setColor] = React.useState<ColorChoice>("auto")
  const [roomCode, setRoomCode] = React.useState("")

  const handlePlay = () => {
    const input: Parameters<typeof actions.joinRoom>[0] = { mode }
    if (mode === HUMAN_VS_AI) input.difficulty = difficulty
    if (color !== "auto") input.color = color
    actions.joinRoom(input)
  }

  const handleJoin = () => {
    const trimmed = roomCode.trim()
    if (!trimmed) return
    // mode is required by the wire shape, but the server only consults
    // it for brand-new rooms — joining an existing one by id ignores it.
    actions.joinRoom({ mode: HUMAN_VS_HUMAN, roomId: trimmed })
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6 rounded-3xl border bg-card p-6 text-card-foreground">
      <div className="flex items-center gap-2">
        <IconChess className="size-5 text-primary" />
        <h1 className="font-heading text-base font-medium">Play chess</h1>
      </div>

      <PillGroup
        label="Opponent"
        options={OPPONENT_OPTIONS}
        value={mode}
        onChange={setMode}
      />

      {mode === HUMAN_VS_AI && (
        <PillGroup
          label="Difficulty"
          options={DIFFICULTY_OPTIONS}
          value={difficulty}
          onChange={setDifficulty}
        />
      )}

      <PillGroup
        label="Play as"
        options={COLOR_OPTIONS}
        value={color}
        onChange={setColor}
      />

      <Button onClick={handlePlay}>
        <IconChess data-icon="inline-start" />
        Play
      </Button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Join a room
        </span>
        <div className="flex gap-2">
          <Input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            placeholder="Room code"
            className={cn("flex-1")}
          />
          <Button
            variant="secondary"
            onClick={handleJoin}
            disabled={!roomCode.trim()}
          >
            <IconDoorEnter data-icon="inline-start" />
            Join
          </Button>
        </div>
      </div>
    </div>
  )
}
