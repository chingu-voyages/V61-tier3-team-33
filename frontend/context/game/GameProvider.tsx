"use client"

import { useReducer, useMemo } from "react"
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
} from "@/socket/events"
import { FEN } from "@/core/fen"
import { Board } from "@/core/board"
import { WHITE } from "@/core/piece"

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

const initialState: GameState = {
  board: FEN.boardFromFEN(STARTING_FEN) ?? Board.create(),
  roomId: null,
  color: null,
  started: false,
  isCheck: false,
  result: null,
  clock: null,
  pendingUndo: null,
  turn: WHITE,
  lastMoveRejection: null,
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState)
  const actions = useGameActions()

  useSocketEvent(ROOM_JOINED, (msg) => {
    const board = FEN.boardFromFEN(msg.state.fen)
    if (!board) return
    dispatch({
      type: "ROOM_JOINED",
      roomId: msg.roomId,
      color: msg.color,
      board,
      isCheck: msg.state.isCheck,
      result: msg.state.result,
      turn: msg.state.turn,
    })
  })

  useSocketEvent(GAME_STARTED, (msg) => {
    const board = FEN.boardFromFEN(msg.fen)
    if (!board) return
    dispatch({
      type: "GAME_STARTED",
      board,
      clock: msg.clock,
      turn: msg.turn,
    })
  })

  useSocketEvent(MOVE_MADE, (msg) => {
    dispatch({
      type: "MOVE_RESULT",
      isCheck: msg.isCheck,
      result: msg.result,
      clock: msg.clock,
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
      isCheck: msg.state.isCheck,
      result: msg.state.result,
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

  useSocketEvent(ROOM_LEFT, () => {
    dispatch({ type: "ROOM_LEFT" })
  })

  const value = useMemo(() => ({ state, actions }), [state, actions])

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}
