"use client"

import { use, useReducer, useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { TimeControl as TimeControlPicker } from "./TimeControl"
import { RoomInvite } from "./RoomInvite"
import { MatchSearch } from "./MatchSearch"
import { View } from "@/components/board/View"
import { playReducer, createInitialPhase } from "./play-reducer"
import type { PlayMode, TimeControl, ColorChoice } from "./types"
import { useGameActions } from "@/socket/use-action"
import { SessionContext } from "@/context/session/session-context"
import { useRoom } from "@/context/room/context"
import { gooeyToast } from "@/components/ui/goey-toaster"
import { KnightPulse } from "./KnightPulse"
import { useAutoJoin } from "./use-auto-join"
import { useRoomSync } from "./use-room-sync"
import { HUMAN_VS_HUMAN, ClockFormat, ACTIVE } from "@/socket/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface PlayScreenProps {
  mode: PlayMode
  roomId?: string
  modeExplicit?: boolean
}

export function PlayScreen({
  mode,
  roomId,
  modeExplicit = false,
}: PlayScreenProps) {
  const router = useRouter()
  const [phase, dispatch] = useReducer(
    playReducer,
    { mode, roomId },
    createInitialPhase
  )
  const actions = useGameActions()
  const session = use(SessionContext)
  const room = useRoom()
  const pendingCreateRef = useRef(false)
  const [pendingSwitch, setPendingSwitch] = useState<
    | { kind: "friend"; tc: TimeControl }
    | { kind: "online"; tc: TimeControl }
    | null
  >(null)

  useAutoJoin(phase, session, actions, dispatch)
  useRoomSync(room, phase, dispatch, modeExplicit, pendingCreateRef)

  const goHome = useCallback(() => {
    if (phase.phase !== "pick-time") {
      actions.leaveRoom()
    }
    router.push("/")
  }, [router, actions, phase])

  const inOtherActiveGame = room.state.status === ACTIVE

  const runCreateRoom = useCallback(
    (tc: TimeControl, color?: ColorChoice) => {
      pendingCreateRef.current = true
      const selectedColor = color != null ? color : undefined
      dispatch({ type: "CREATE_ROOM", timeControl: tc, color: selectedColor })
      // Explicit create intent — backend always assigns its own canonical
      // id, returned in room:joined. No client-generated roomId involved.
      actions.joinRoom({
        mode: HUMAN_VS_HUMAN,
        create: true,
        clock: ClockFormat(tc.id),
        color: selectedColor,
      })
    },
    [actions]
  )

  const runStartSearch = useCallback(
    (tc: TimeControl) => {
      dispatch({ type: "START_SEARCH", timeControl: tc })
      actions.joinRoom({ mode: HUMAN_VS_HUMAN, clock: ClockFormat(tc.id) })
    },
    [actions]
  )

  const createRoom = useCallback(
    (tc: TimeControl, color?: ColorChoice) => {
      if (!session) {
        gooeyToast.error("Still connecting\u2026", {
          description: "Hang tight, try again in a moment.",
        })
        return
      }
      if (inOtherActiveGame) {
        setPendingSwitch({ kind: "friend", tc })
        return
      }
      runCreateRoom(tc, color)
    },
    [session, inOtherActiveGame, runCreateRoom]
  )

  const startSearch = useCallback(
    (tc: TimeControl) => {
      if (!session) {
        gooeyToast.error("Still connecting\u2026", {
          description: "Hang tight, try again in a moment.",
        })
        return
      }
      if (inOtherActiveGame) {
        setPendingSwitch({ kind: "online", tc })
        return
      }
      runStartSearch(tc)
    },
    [session, inOtherActiveGame, runStartSearch]
  )

  const confirmSwitch = useCallback(() => {
    if (!pendingSwitch) return
    const { kind, tc } = pendingSwitch
    setPendingSwitch(null)
    if (kind === "friend") runCreateRoom(tc)
    else runStartSearch(tc)
  }, [pendingSwitch, runCreateRoom, runStartSearch])

  if (phase.phase === "joining" || phase.phase === "creating") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <KnightPulse />
        <p className="text-sm text-muted-foreground">
          {phase.phase === "creating"
            ? "Creating room\u2026"
            : "Joining game\u2026"}
        </p>
      </div>
    )
  }

  if (phase.phase === "pick-time") {
    return (
      <>
        <TimeControlPicker
          mode={phase.mode}
          open
          connecting={!session}
          onPick={phase.mode === "friend" ? createRoom : startSearch}
          onCancel={goHome}
        />
        <Dialog
          open={pendingSwitch !== null}
          onOpenChange={(next) => {
            if (!next) setPendingSwitch(null)
          }}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Leave your current game?</DialogTitle>
              <DialogDescription>
                You&apos;re still in an active game. Starting a new one will end
                that game as a loss for you — your opponent will be notified.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPendingSwitch(null)}>
                Stay in my game
              </Button>
              <Button onClick={confirmSwitch}>Leave &amp; continue</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  if (phase.phase === "invite") {
    return (
      <RoomInvite
        roomId={phase.roomId}
        timeControl={phase.timeControl}
        color={phase.color}
        onCancel={goHome}
      />
    )
  }

  if (phase.phase === "search") {
    return <MatchSearch timeControl={phase.timeControl} onCancel={goHome} />
  }

  return <View onLeave={goHome} />
}
