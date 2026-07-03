import { describe, expect, test } from "bun:test"
import {
  Commands,
  GAME_RESIGN,
  HUMAN_VS_AI,
  MOVE_MAKE,
  POSITION_SELECT,
  ROOM_JOIN,
  ROOM_LEAVE,
  SESSION_HANDSHAKE,
  SESSION_PONG,
  STATE_SYNC,
  UNDO_ACCEPT,
  UNDO_DECLINE,
  UNDO_REQUEST,
} from "./commands"
import { Position } from "@/lib/core/position"
import { WHITE } from "@/lib/core/piece"

describe("Commands", () => {
  test("handshake() without a token omits the field entirely", () => {
    expect(Commands.handshake()).toEqual({ type: SESSION_HANDSHAKE })
    expect("token" in Commands.handshake()).toBe(false)
  })

  test("handshake() with a token includes it", () => {
    expect(Commands.handshake("tok")).toEqual({
      type: SESSION_HANDSHAKE,
      token: "tok",
    })
  })

  test("pong() is a bare tag", () => {
    expect(Commands.pong()).toEqual({ type: SESSION_PONG })
  })

  test("joinRoom() spreads the input alongside the tag", () => {
    const input = { mode: HUMAN_VS_AI, color: WHITE }
    expect(Commands.joinRoom(input)).toEqual({ type: ROOM_JOIN, ...input })
  })

  test("leaveRoom() is a bare tag", () => {
    expect(Commands.leaveRoom()).toEqual({ type: ROOM_LEAVE })
  })

  test("makeMove() spreads from/to (and promoteTo when present)", () => {
    const input = { from: Position(8), to: Position(16) }
    expect(Commands.makeMove(input)).toEqual({ type: MOVE_MAKE, ...input })
  })

  test("requestUndo/acceptUndo/declineUndo are bare tags", () => {
    expect(Commands.requestUndo()).toEqual({ type: UNDO_REQUEST })
    expect(Commands.acceptUndo()).toEqual({ type: UNDO_ACCEPT })
    expect(Commands.declineUndo()).toEqual({ type: UNDO_DECLINE })
  })

  test("resign() and syncState() are bare tags", () => {
    expect(Commands.resign()).toEqual({ type: GAME_RESIGN })
    expect(Commands.syncState()).toEqual({ type: STATE_SYNC })
  })

  test("selectPosition() spreads the position alongside the tag", () => {
    const input = { position: Position(8) }
    expect(Commands.selectPosition(input)).toEqual({
      type: POSITION_SELECT,
      ...input,
    })
  })
})
