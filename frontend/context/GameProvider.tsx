"use client"

import { useReducer } from "react"
import { gameReducer, GameContext, type GameState } from "./use-game"
import { FEN } from "@/lib/core/fen"
import { Board } from "@/lib/core/board"
import { PieceColor } from "@/lib/core/piece"
import { useSocketEvent } from "@/socket/use-socket-event"
import { useGameActions } from "@/socket/game-actions"
import {
  GAME_ENDED,
  GAME_STARTED,
  GameOutcome,
  MOVE_MADE,
  MOVE_REJECTED,
  ROOM_JOINED,
  ROOM_LEFT,
  UNDO_APPLIED,
  UNDO_DECLINED,
  UNDO_REQUESTED,
  WAITING,
} from "@/socket/incoming"

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

const initialGameState: GameState = {
  board: FEN.boardFromFEN(STARTING_FEN) ?? Board.create(),
  roomId: null,
  color: null,
  started: false,
  isCheck: false,
  result: null,
  clock: null,
  pendingUndo: null,
  turn: null,
  lastMoveRejection: null,
}

/**
 * Owns the game reducer and wires it to the socket — the game-side
 * counterpart of SessionProvider. Each notification maps to one
 * useSocketEvent subscription. `actions` (socket/game-actions.ts) is the
 * outbound half — join/move/undo/resign/sync — exposed alongside `state`
 * so consumers never touch `send` directly.
 *
 * MOVE_MADE only carries the applied move, not a fresh board — there's no
 * client-side move-application engine yet to derive the resulting
 * position from that alone. So a move triggers `syncState()`, answered
 * with a fresh ROOM_JOINED carrying the authoritative FEN. `isCheck` /
 * `result` / `clock` are still applied immediately from MOVE_MADE for a
 * snappier UI while that sync is in flight. Swap this for direct move
 * application once a board-mutation module exists on the frontend.
 */
export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState)
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
      result: GameOutcome.fromSnapshot(msg.state),
      turn: FEN.sideToMoveFromFEN(msg.state.fen),
      // A reload re-joins an already-active (or finished) room via
      // ROOM_JOINED alone — GAME_STARTED only fires once, the moment the
      // second seat fills, so it never re-fires here. Deriving `started`
      // from the room's own lifecycle status (rather than waiting on a
      // GAME_STARTED that isn't coming) is what lets the reload land on
      // "game" instead of getting stuck on "waiting".
      started: msg.state.status !== WAITING,
    })
  })

  useSocketEvent(GAME_STARTED, (msg) => {
    const board = FEN.boardFromFEN(msg.fen)
    if (!board) return
    dispatch({
      type: "GAME_STARTED",
      board,
      clock: msg.clock,
      turn: FEN.sideToMoveFromFEN(msg.fen),
    })
  })

  useSocketEvent(MOVE_MADE, (msg) => {
    dispatch({
      type: "MOVE_RESULT",
      isCheck: msg.isCheck,
      result: msg.result,
      clock: msg.clock,
      // Optimistic flip — the mover's turn just ended. The follow-up
      // syncState() below confirms it against the authoritative FEN.
      turn: PieceColor.opponent(msg.by),
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
      result: GameOutcome.fromSnapshot(msg.state),
      turn: FEN.sideToMoveFromFEN(msg.state.fen),
    })
  })

  useSocketEvent(GAME_ENDED, (msg) => {
    dispatch({ type: "GAME_ENDED", result: msg.result })
  })

  useSocketEvent(MOVE_REJECTED, (msg) => {
    dispatch({
      type: "MOVE_REJECTED",
      reason: msg.reason,
      from: msg.from,
      to: msg.to,
    })
  })

  useSocketEvent(UNDO_REQUESTED, (msg) => {
    dispatch({ type: "UNDO_REQUESTED", by: msg.by, expiresAt: msg.expiresAt })
  })

  useSocketEvent(UNDO_DECLINED, () => {
    dispatch({ type: "UNDO_RESOLVED" })
  })

  useSocketEvent(ROOM_LEFT, (msg) => {
    // Only clear our own seat — this notification also reaches us when
    // the *opponent* leaves, and losing roomId/color in that case would
    // wrongly boot the still-seated player.
    if (msg.color === state.color) {
      dispatch({ type: "ROOM_LEFT" })
    }
  })

  return (
    <GameContext.Provider value={{ state, actions }}>
      {children}
    </GameContext.Provider>
  )
}
