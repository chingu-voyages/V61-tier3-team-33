"use client"

import { IconSend2 } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Commands,
  SESSION_HANDSHAKE,
  ROOM_JOIN,
  ROOM_LEAVE,
  MOVE_MAKE,
  UNDO_REQUEST,
  UNDO_ACCEPT,
  UNDO_DECLINE,
  GAME_RESIGN,
  STATE_SYNC,
  SESSION_PONG,
} from "@/socket/commands"
import { Position } from "@/core/position"
import { EASY, HUMAN_VS_AI, HUMAN_VS_HUMAN } from "@/socket/types"

export interface QuickCommand {
  label: string
  payload: object
  immediate: boolean
}

const QUICK_COMMANDS: QuickCommand[] = [
  { label: SESSION_HANDSHAKE, payload: Commands.handshake(), immediate: false },
  {
    label: ROOM_JOIN,
    payload: Commands.joinRoom({ mode: HUMAN_VS_HUMAN }),
    immediate: false,
  },
  {
    label: ROOM_JOIN,
    payload: Commands.joinRoom({ mode: HUMAN_VS_AI, difficulty: EASY }),
    immediate: false,
  },
  { label: ROOM_LEAVE, payload: Commands.leaveRoom(), immediate: true },
  {
    label: MOVE_MAKE,
    payload: Commands.makeMove({ from: Position(8), to: Position(16) }),
    immediate: false,
  },
  { label: UNDO_REQUEST, payload: Commands.requestUndo(), immediate: true },
  { label: UNDO_ACCEPT, payload: Commands.acceptUndo(), immediate: true },
  { label: UNDO_DECLINE, payload: Commands.declineUndo(), immediate: true },
  { label: GAME_RESIGN, payload: Commands.resign(), immediate: true },
  { label: STATE_SYNC, payload: Commands.syncState(), immediate: true },
  { label: SESSION_PONG, payload: Commands.pong(), immediate: true },
]

export function QuickSend({ onPick }: { onPick: (cmd: QuickCommand) => void }) {
  const immediate = QUICK_COMMANDS.filter((c) => c.immediate)
  const drafts = QUICK_COMMANDS.filter((c) => !c.immediate)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="xs" variant="outline">
            <IconSend2 data-icon="inline-start" />
            Quick send
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <div className="px-3 py-1.5 text-xs text-muted-foreground">
          Fires immediately
        </div>
        {immediate.map((cmd, i) => (
          <DropdownMenuItem
            key={`${cmd.label}-${i}`}
            onClick={() => onPick(cmd)}
          >
            {cmd.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="px-3 py-1.5 text-xs text-muted-foreground">
          Fills the editor below
        </div>
        {drafts.map((cmd, i) => (
          <DropdownMenuItem
            key={`${cmd.label}-${i}`}
            onClick={() => onPick(cmd)}
          >
            {cmd.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
