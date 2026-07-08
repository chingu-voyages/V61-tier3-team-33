"use client"

import { useReducer, useMemo, useEffect } from "react"
import { gooeyToast } from "@/components/ui/goey-toaster"
import { gameReducer, type GameState } from "./game-reducer"
import { GameContext } from "./game-context"
import { useSocketEvent } from "@/socket/use-event"
import { useGameActions } from "@/socket/use-action"
import {
  ROOM_JOINED,
  GAME_STARTED,
  MOVE_MADE,
  UNDO_APPLIED,
  GAME_ENDED,
  UNDO_REQUESTED,
  UNDO_DECLINED,
  MOVE_REJECTED,
  ROOM_LEFT,
  GRACE_STARTED,
  GRACE_CANCELLED,
  GRACE_EXPIRED,
  CLOCK_EXPIRED,
} from "@/socket/events"
import { FINISHED } from "@/socket/types"
import { FEN } from "@/core/fen"
import { Board } from "@/core/board"
import { WHITE } from "@/core/piece"
import { useConnection } from "@/hooks/use-connection"

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

const initialState: GameState = {
  board: FEN.boardFromFEN(STARTING_FEN) ?? Board.create(),
  roomId: null,
  color: null,
  status: null,
  isCheck: false,
  result: null,
  clock: null,
  clockReceivedAt: null,
  pendingUndo: null,
  turn: WHITE,
  lastMoveRejection: null,
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState)
  const actions = useGameActions()
  useConnection()

  useSocketEvent(ROOM_JOINED, (msg) => {
    const board = FEN.boardFromFEN(msg.state.fen)
    if (!board) return
    dispatch({
      type: "ROOM_JOINED",
      roomId: msg.roomId,
      color: msg.color,
      board,
      status: msg.state.status,
      isCheck: msg.state.isCheck,
      turn: msg.state.turn,
      clock: msg.state.clock,
      clockReceivedAt: msg.state.clock !== null ? performance.now() : null,
    })
  })

  useSocketEvent(GAME_STARTED, (msg) => {
    const board = FEN.boardFromFEN(msg.fen)
    if (!board) return
    dispatch({
      type: "GAME_STARTED",
      board,
      clock: msg.clock,
      clockReceivedAt: msg.clock !== null ? performance.now() : null,
      turn: msg.turn,
    })
  })

  useSocketEvent(MOVE_MADE, (msg) => {
    dispatch({
      type: "MOVE_RESULT",
      isCheck: msg.isCheck,
      result: msg.result,
      clock: msg.clock,
      clockReceivedAt: msg.clock !== null ? performance.now() : null,
      turn: msg.turn,
    })
    actions.syncState()
  })

  useSocketEvent(UNDO_APPLIED, (msg) => {
    const board = FEN.boardFromFEN(msg.state.fen)
    if (!board) return
    dispatch({
      type: "UNDO_APPLIED",
      board,
      status: msg.state.status,
      isCheck: msg.state.isCheck,
      turn: msg.state.turn,
    })
  })

  useSocketEvent(GAME_ENDED, (msg) => {
    dispatch({ type: "GAME_ENDED", result: msg.result })
  })

  useSocketEvent(UNDO_REQUESTED, (msg) => {
    dispatch({ type: "UNDO_REQUESTED", by: msg.by, expiresAt: msg.expiresAt })
  })

  useSocketEvent(UNDO_DECLINED, () => {
    dispatch({ type: "UNDO_RESOLVED" })
  })

  useSocketEvent(MOVE_REJECTED, (msg) => {
    dispatch({
      type: "MOVE_REJECTED",
      reason: msg.reason,
      from: msg.from,
      to: msg.to,
    })
  })

  useSocketEvent(ROOM_LEFT, (msg) => {
    if (msg.color !== state.color) {
      const who = msg.color === WHITE ? "White" : "Black"
      gooeyToast.info(`${who} left the game`)
    }
    dispatch({ type: "ROOM_LEFT", color: msg.color })
  })

  useSocketEvent(GRACE_STARTED, (msg) => {
    const you = msg.color === WHITE ? "Black" : "White"
    gooeyToast.warning(`${you} disconnected`, {
      description: "Waiting for reconnection...",
      duration: 10_000,
    })
  })

  useSocketEvent(GRACE_CANCELLED, (msg) => {
    const you = msg.color === WHITE ? "Black" : "White"
    gooeyToast.success(`${you} reconnected`)
  })

  useSocketEvent(GRACE_EXPIRED, () => {
    gooeyToast.info("Game abandoned - opponent did not return")
  })

  useSocketEvent(CLOCK_EXPIRED, (msg) => {
    const color = msg.color === WHITE ? "White" : "Black"
    gooeyToast.error(`${color} ran out of time`)
  })

  useEffect(() => {
    if (!state.clock || state.clock.active === null || state.status === FINISHED) return
    const interval = setInterval(() => {
      dispatch({ type: "CLOCK_TICK" })
    }, 1000)
    return () => clearInterval(interval)
  }, [state.clock?.active, state.status])

  const value = useMemo(() => ({ state, actions }), [state, actions])

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}
