"use client"

import { use, useReducer, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { TimeControl as TimeControlPicker } from "./TimeControl"
import { RoomInvite } from "./RoomInvite"
import { MatchSearch } from "./MatchSearch"
import { View } from "@/components/board/View"
import { playReducer, createInitialPhase } from "./play-reducer"
import type { PlayMode, TimeControl } from "./types"
import { useGameActions } from "@/socket/use-action"
import { useSocketEvent } from "@/socket/use-event"
import { GAME_STARTED, ROOM_JOINED } from "@/socket/events"
import { SESSION_ERROR } from "@/socket/errors"
import { ClockFormat, HUMAN_VS_HUMAN, ACTIVE } from "@/socket/types"
import { SessionContext } from "@/context/session/session-context"
import { useRoom } from "@/context/room/context"
import { gooeyToast } from "@/components/ui/goey-toaster"
import { KnightPulse } from "./KnightPulse"

interface PlayScreenProps {
  mode: PlayMode
  roomId?: string
}

export function PlayScreen({ mode, roomId }: PlayScreenProps) {
  const router = useRouter()
  const [phase, dispatch] = useReducer(playReducer, { mode, roomId }, createInitialPhase)
  const actions = useGameActions()
  const session = use(SessionContext)
  const joinSentRef = useRef(false)
  const connectionGenRef = useRef(0)
  const room = useRoom()

  useEffect(() => {
    if (room.state.roomId && room.state.status !== null && room.state.status >= ACTIVE && phase.phase !== "play") {
      dispatch({ type: "OPPONENT_JOINED" })
    }
  }, [room.state.roomId, room.state.status, phase.phase])

  const goHome = useCallback(() => {
    if (phase.phase !== "pick-time") {
      actions.leaveRoom()
    }
    router.push("/")
  }, [router, actions, phase])

  const createRoom = useCallback(
    (tc: TimeControl) => {
      // Guard against clicking before handshake — prevents stranded invite phase.
      if (!session) {
        gooeyToast.error("Still connecting\u2026", {
          description: "Hang tight, try again in a moment.",
        })
        return
      }
      const id = crypto.randomUUID().slice(0, 8)
      dispatch({
        type: "CREATE_ROOM",
        roomId: id,
        timeControl: tc,
      })
      actions.joinRoom({ mode: HUMAN_VS_HUMAN, roomId: id, clock: ClockFormat(tc.id) })
    },
    [actions, session]
  )

  const startSearch = useCallback(
    (tc: TimeControl) => {
      if (!session) {
        gooeyToast.error("Still connecting\u2026", {
          description: "Hang tight, try again in a moment.",
        })
        return
      }
      dispatch({ type: "START_SEARCH", timeControl: tc })
      actions.joinRoom({ mode: HUMAN_VS_HUMAN, clock: ClockFormat(tc.id) })
    },
    [actions, session]
  )

  // Auto-join via invite link. Re-fires on reconnect when session flips to non-null.
  useEffect(() => {
    if (session && phase.phase === "joining" && !joinSentRef.current) {
      joinSentRef.current = true
      connectionGenRef.current++
      actions.joinRoom({ mode: HUMAN_VS_HUMAN, roomId: phase.roomId })
    }
  }, [session, phase, actions])

  useSocketEvent(SESSION_ERROR, (msg) => {
    if (phase.phase !== "joining") return
    joinSentRef.current = false
    gooeyToast.error("Couldn't join game", { description: msg.message })
    dispatch({ type: "JOIN_FAILED", mode: "friend" })
  })

  useSocketEvent(GAME_STARTED, () => {
    dispatch({ type: "OPPONENT_JOINED" })
  })

  useSocketEvent(ROOM_JOINED, (msg) => {
    if (msg.state.status >= ACTIVE) {
      dispatch({ type: "OPPONENT_JOINED" })
    }
  })

  if (phase.phase === "joining") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <KnightPulse />
        <p className="text-sm text-muted-foreground">Joining game…</p>
      </div>
    )
  }

  if (phase.phase === "pick-time") {
    return (
      <TimeControlPicker
        mode={phase.mode}
        open
        connecting={!session}
        onPick={phase.mode === "friend" ? createRoom : startSearch}
        onCancel={goHome}
      />
    )
  }

  if (phase.phase === "invite") {
    return (
      <RoomInvite
        roomId={phase.roomId}
        timeControl={phase.timeControl}
        onCancel={goHome}
      />
    )
  }

  if (phase.phase === "search") {
    return (
      <MatchSearch
        timeControl={phase.timeControl}
        onCancel={goHome}
      />
    )
  }

  return <View onLeave={goHome} />
}
