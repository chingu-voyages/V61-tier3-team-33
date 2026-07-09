import { describe, expect, test } from "bun:test"
import { ChessStoreImpl } from "./store"
import type { Position } from "./core/position"
import { Board, Square } from "./core/board"
import { A7, A8, E2, E4, E5, E6, E7 } from "./core/position"
import { WHITE, PAWN, QUEEN } from "./core/piece"
import { MoveType, type Move } from "./core/move"

describe("ChessStore", () => {
  function makeStore() {
    return new ChessStoreImpl(() => {})
  }

  test("initializes with starting position", () => {
    const store = makeStore()
    const state = store.snapshot()
    expect(state.fen).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    expect(state.board.length).toBe(64)
    expect(state.selected).toBeNull()
    expect(state.legalMoves).toEqual([])
    expect(state.lastMove).toBeNull()
    expect(state.moveRejection).toBeNull()
    expect(state.pendingMove).toBeNull()
    expect(state.clock).toBeNull()
    expect(state.clockReceivedAt).toBeNull()
  })

  test("subscribe notifies on state change", () => {
    const store = makeStore()
    let calls = 0
    store.subscribe(() => calls++)
    store.select(0 as unknown as Position)
    expect(calls).toBe(1)
  })

  test("subscribe unsubscribe stops notifications", () => {
    const store = makeStore()
    let calls = 0
    const unsub = store.subscribe(() => calls++)
    unsub()
    store.select(0 as unknown as Position)
    expect(calls).toBe(0)
  })

  test("makeMove applies locally and sends command", () => {
    const sent: object[] = []
    const store = new ChessStoreImpl((cmd) => sent.push(cmd))

    store.select(E2)
    store.makeMove(E2, E4)

    const s = store.snapshot()
    expect(s.lastMove).toEqual({ from: E2, to: E4 })
    expect(s.pendingMove).toEqual({ from: E2, to: E4 })
    // Pawn should be at e4
    const piece = Square.decode(Board.at(s.board, E4))
    expect(piece).toEqual({ color: WHITE, type: PAWN })
    // E2 should be empty
    expect(Square.isEmpty(Board.at(s.board, E2))).toBe(true)
    // Should have sent move:make and cleared selection
    expect(sent).toContainEqual({ type: "move:make", from: E2, to: E4 })
    expect(s.selected).toBeNull()
    expect(s.legalMoves).toEqual([])
  })

  test("makeMove skips if from square is empty", () => {
    const sent: { type: string }[] = []
    const store = new ChessStoreImpl((cmd) => sent.push(cmd as { type: string }))
    store.makeMove(E2, E4)
    const afterFirst = store.snapshot().fen
    // Second call should no-op since e2 is empty
    store.makeMove(E2, E4)
    expect(store.snapshot().fen).toBe(afterFirst)
    expect(sent.filter((c) => c.type === "move:make").length).toBe(1)
  })

  test("makeMove skips if there is already a pending move", () => {
    const sent: { type: string }[] = []
    const store = new ChessStoreImpl((cmd) => sent.push(cmd as { type: string }))
    store.makeMove(E2, E4)
    const fen = store.snapshot().fen
    store.makeMove(0 as unknown as Position, 0 as unknown as Position)
    expect(store.snapshot().fen).toBe(fen)
    expect(sent.filter((c) => c.type === "move:make").length).toBe(1)
  })

  test("confirmMove clears pending state", () => {
    const store = new ChessStoreImpl(() => {})
    store.makeMove(E2, E4)
    expect(store.snapshot().pendingMove).not.toBeNull()

    store.confirmMove()
    expect(store.snapshot().pendingMove).toBeNull()
  })

  const e4Move: Move = {
    piece: { color: WHITE, type: PAWN },
    from: E2,
    to: E4,
    type: MoveType(0),
    promoteTo: null,
    captured: null,
  }

  test("applyMove updates board for opponent move", () => {
    const store = new ChessStoreImpl(() => {})
    store.applyMove(e4Move)
    const s = store.snapshot()
    expect(s.fen).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1")
    expect(s.lastMove).toEqual({ from: E2, to: E4 })
    expect(Square.isEmpty(Board.at(s.board, E2))).toBe(true)
  })

  test("applyMove when pendingRef matches confirms own move", () => {
    const store = new ChessStoreImpl(() => {})
    store.makeMove(E2, E4)
    expect(store.snapshot().pendingMove).not.toBeNull()

    store.applyMove(e4Move)
    // Should have cleared pendingMove without double-applying
    expect(store.snapshot().pendingMove).toBeNull()
    expect(store.snapshot().fen).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1")
  })

  test("rejectMove reverts board and stores reason", () => {
    const store = new ChessStoreImpl(() => {})
    store.makeMove(E2, E4)

    store.rejectMove("illegal-move", E2, E4)
    const s = store.snapshot()
    // Board should be back to starting position
    expect(s.fen).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    expect(s.moveRejection).toBe("illegal-move")
    expect(s.pendingMove).toBeNull()
  })

  test("black can select and move after opponent's move", () => {
    const sent: { type: string }[] = []
    const store = new ChessStoreImpl((cmd) => sent.push(cmd as { type: string }))
    const e4: Move = {
      piece: { color: WHITE, type: PAWN },
      from: E2, to: E4,
      type: MoveType(0), promoteTo: null, captured: null,
    }
    store.applyMove(e4)

    const afterWhite = store.snapshot()
    expect(afterWhite.fen).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1")

    store.select(E7)
    expect(store.snapshot().selected).toBe(E7)
    expect(store.snapshot().legalMoves).toEqual([E6, E5])

    store.makeMove(E7, E5)
    const afterBlack = store.snapshot()
    expect(afterBlack.fen).toBe("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2")
    expect(sent.filter((c) => c.type === "move:make").length).toBe(1)
  })

  test("makeMove intercepts promotion and confirmPromotion applies it", () => {
    const sent: object[] = []
    const store = new ChessStoreImpl((cmd) => sent.push(cmd), "8/P7/8/8/8/8/8/8 w - - 0 1")
    const fenBefore = store.snapshot().fen

    store.select(A7)
    expect(store.snapshot().selected).toBe(A7)
    expect(store.snapshot().legalMoves).toContain(A8)

    store.makeMove(A7, A8)
    expect(store.snapshot().pendingPromotion).toEqual({ from: A7, to: A8 })
    expect(store.snapshot().pendingMove).toBeNull()
    expect(store.snapshot().fen).toBe(fenBefore)
    expect(sent.filter((c) => (c as { type: string }).type === "move:make").length).toBe(0)

    store.confirmPromotion(QUEEN)
    const state = store.snapshot()
    expect(state.pendingPromotion).toBeNull()
    expect(state.pendingMove).toEqual({ from: A7, to: A8 })
    expect(Square.isEmpty(Board.at(state.board, A7))).toBe(true)
    const piece = Square.decode(Board.at(state.board, A8))
    expect(piece).toEqual({ color: WHITE, type: QUEEN })
    expect(sent).toContainEqual({ type: "move:make", from: A7, to: A8, promoteTo: QUEEN })
  })
})
