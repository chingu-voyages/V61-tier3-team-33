"use client"

import { useEffect, useMemo, useSyncExternalStore } from "react"
import { ChessContext } from "./context"
import { Chess } from "./index"
import { useSocketContext } from "@/socket/context"
import { useSocketEvent } from "@/socket/use-event"
import { gooeyToast } from "@/components/ui/goey-toaster"
import { ERROR_MESSAGES } from "@/socket/errors"
import { useSoundContext } from "@/audio/context"
import {
  ROOM_JOINED,
  GAME_STARTED,
  MOVE_MADE,
  MOVE_REJECTED,
  POSITION_ACCEPTED,
  POSITION_REJECTED,
  UNDO_APPLIED,
} from "@/socket/events"

export function ChessProvider({ children }: { children: React.ReactNode }) {
  const { send } = useSocketContext()
  const sound = useSoundContext()

  const store = useMemo(() => new Chess(send), [send])

  const state = useSyncExternalStore(
    store.subscribe,
    store.snapshot,
    store.snapshot
  )

  // Play move/capture sounds the instant a move is applied locally
  useEffect(() => {
    store.setOnLocalMove((move) => {
      if (move.captured) sound.playCapture()
      else sound.playMove()
    })
    return () => store.setOnLocalMove(null)
  }, [store, sound])

  useSocketEvent(ROOM_JOINED, (msg) => {
    store.loadFen(msg.state.fen)
    store.setClock(
      msg.state.clock,
      msg.state.clock !== null ? performance.now() : null
    )
  })

  useSocketEvent(GAME_STARTED, (msg) => {
    store.loadFen(msg.fen)
    store.setClock(msg.clock, msg.clock !== null ? performance.now() : null)
  })

  useSocketEvent(MOVE_MADE, (msg) => {
    const isOwnMove =
      store.snapshot().pendingMove !== null &&
      store.snapshot().pendingMove!.from === msg.move.from &&
      store.snapshot().pendingMove!.to === msg.move.to

    if (isOwnMove) {
      // Already applied + sounded optimistically when the move was made —
      // this is just the server confirming it, so don't re-play the sound.
      store.confirmMove()
    } else {
      // Opponent's move (or a move we didn't already apply locally): this
      // is the first we're hearing of it, so play the sound now.
      store.applyMove(msg.move)
      if (msg.move.captured) sound.playCapture()
      else sound.playMove()
    }
    store.setClock(msg.clock, msg.clock !== null ? performance.now() : null)
  })

  useSocketEvent(MOVE_REJECTED, (msg) => {
    store.rejectMove(msg.reason, msg.from, msg.to)
    const description = ERROR_MESSAGES[msg.reason]
    if (description) {
      gooeyToast.error(description)
    }
  })

  useSocketEvent(POSITION_ACCEPTED, (msg) => {
    store.selectAccepted(msg.position, msg.moves)
  })

  useSocketEvent(POSITION_REJECTED, (msg) => {
    store.selectRejected()
    const description = ERROR_MESSAGES[msg.reason]
    if (description) {
      gooeyToast.error(description)
    }
  })

  useSocketEvent(UNDO_APPLIED, (msg) => {
    store.loadFen(msg.state.fen)
    store.setClock(
      msg.state.clock,
      msg.state.clock !== null ? performance.now() : null
    )
  })

  return (
    <ChessContext.Provider
      value={{
        state,
        makeMove: store.makeMove,
        select: store.select,
        clearSelection: store.clearSelection,
        confirmPromotion: store.confirmPromotion,
        cancelPromotion: store.cancelPromotion,
      }}
    >
      {children}
    </ChessContext.Provider>
  )
}
