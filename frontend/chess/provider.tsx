"use client"

import { useMemo, useSyncExternalStore } from "react"
import { ChessContext } from "./context"
import { Chess } from "./index"
import { useSocketContext } from "@/socket/context"
import { useSocketEvent } from "@/socket/use-event"
import { gooeyToast } from "@/components/ui/goey-toaster"
import { ERROR_MESSAGES } from "@/socket/errors"
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

  const store = useMemo(() => new Chess(send), [send])

  const state = useSyncExternalStore(
    store.subscribe,
    store.snapshot,
    store.snapshot
  )

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
    if (
      store.snapshot().pendingMove &&
      store.snapshot().pendingMove!.from === msg.move.from &&
      store.snapshot().pendingMove!.to === msg.move.to
    ) {
      store.confirmMove()
    } else {
      store.applyMove(msg.move)
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
