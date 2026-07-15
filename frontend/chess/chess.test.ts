import { describe, expect, test } from "bun:test"
import { Chess } from "./index"
import type { Position } from "./core/position"
import { Board, Square } from "./core/board"
import {
  A7,
  A8,
  D8,
  E1,
  E2,
  E3,
  E4,
  E5,
  E6,
  E7,
  F2,
  F3,
  G2,
  G4,
  H4,
} from "./core/position"
import { WHITE, BLACK, PAWN, KNIGHT, QUEEN } from "./core/piece"
import { MoveType, type Move } from "./core/move"
import { IN_PROGRESS, CHECKMATE } from "./core/game"

describe("Chess", () => {
  function makeStore(): Chess {
    return new Chess(() => {})
  }

  // ── Constructor & snapshot ────────────────────────────

  test("initializes with starting position", () => {
    const store = makeStore()
    const state = store.snapshot()
    expect(state.fen).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    )
    expect(state.board.length).toBe(64)
    expect(state.selected).toBeNull()
    expect(state.legalMoves).toEqual([])
    expect(state.lastMove).toBeNull()
    expect(state.moveRejection).toBeNull()
    expect(state.pendingMove).toBeNull()
    expect(state.clock).toBeNull()
    expect(state.clockReceivedAt).toBeNull()
  })

  test("initializes with custom FEN", () => {
    const fen = "8/P7/8/8/8/8/8/8 w - - 0 1"
    const store = new Chess(() => {}, fen)
    expect(store.snapshot().fen).toBe(fen)
  })

  test("snapshot returns fresh state after mutation", () => {
    const store = makeStore()
    const s1 = store.snapshot()
    store.select(E2)
    const s2 = store.snapshot()
    expect(s1).not.toBe(s2)
    expect(s2.selected).toBe(E2)
  })

  // ── Subscribe ─────────────────────────────────────────

  test("notifies on state change", () => {
    const store = makeStore()
    let calls = 0
    store.subscribe(() => calls++)
    store.select(E2)
    expect(calls).toBe(1)
  })

  test("unsubscribe stops notifications", () => {
    const store = makeStore()
    let calls = 0
    const unsub = store.subscribe(() => calls++)
    unsub()
    store.select(E2)
    expect(calls).toBe(0)
  })

  test("multiple listeners all notified", () => {
    const store = makeStore()
    let a = 0
    let b = 0
    store.subscribe(() => a++)
    store.subscribe(() => b++)
    store.select(E2)
    expect(a).toBe(1)
    expect(b).toBe(1)
  })

  // ── makeMove ──────────────────────────────────────────

  test("applies locally and sends command", () => {
    const sent: object[] = []
    const store = new Chess((cmd) => sent.push(cmd))

    store.select(E2)
    store.makeMove(E2, E4)

    const s = store.snapshot()
    expect(s.lastMove).toEqual({ from: E2, to: E4, type: MoveType(0) })
    expect(s.pendingMove).toEqual({ from: E2, to: E4 })
    const piece = Square.decode(Board.at(s.board, E4))
    expect(piece).toEqual({ color: WHITE, type: PAWN })
    expect(Square.isEmpty(Board.at(s.board, E2))).toBe(true)
    expect(sent).toContainEqual({ type: "move:make", from: E2, to: E4 })
    expect(s.selected).toBeNull()
    expect(s.legalMoves).toEqual([])
  })

  test("skips if from square is empty", () => {
    const sent: { type: string }[] = []
    const store = new Chess((cmd) => sent.push(cmd as { type: string }))
    store.makeMove(E2, E4)
    const afterFirst = store.snapshot().fen
    store.makeMove(E2, E4)
    expect(store.snapshot().fen).toBe(afterFirst)
    expect(sent.filter((c) => c.type === "move:make").length).toBe(1)
  })

  test("skips if there is already a pending move", () => {
    const sent: { type: string }[] = []
    const store = new Chess((cmd) => sent.push(cmd as { type: string }))
    store.makeMove(E2, E4)
    const fen = store.snapshot().fen
    store.makeMove(E2 as unknown as Position, E2 as unknown as Position)
    expect(store.snapshot().fen).toBe(fen)
    expect(sent.filter((c) => c.type === "move:make").length).toBe(1)
  })

  test("skips if destination is not a legal move", () => {
    const store = makeStore()
    store.makeMove(E2, E5)
    expect(store.snapshot().pendingMove).toBeNull()
  })

  // ── confirmPromotion / cancelPromotion ─────────────────

  test("makeMove with promotion candidate shows pendingPromotion", () => {
    const store = new Chess(() => {}, "8/P7/8/8/8/8/8/8 w - - 0 1")
    const fenBefore = store.snapshot().fen
    store.makeMove(A7, A8)
    expect(store.snapshot().pendingPromotion).toEqual({ from: A7, to: A8 })
    expect(store.snapshot().pendingMove).toBeNull()
    expect(store.snapshot().fen).toBe(fenBefore)
  })

  test("confirmPromotion applies promotion and sends promoteTo", () => {
    const sent: object[] = []
    const store = new Chess(
      (cmd) => sent.push(cmd),
      "8/P7/8/8/8/8/8/8 w - - 0 1"
    )

    store.makeMove(A7, A8)
    store.confirmPromotion(QUEEN)

    const state = store.snapshot()
    expect(state.pendingPromotion).toBeNull()
    expect(state.pendingMove).toEqual({ from: A7, to: A8 })
    expect(Square.isEmpty(Board.at(state.board, A7))).toBe(true)
    const piece = Square.decode(Board.at(state.board, A8))
    expect(piece).toEqual({ color: WHITE, type: QUEEN })
    expect(sent).toContainEqual({
      type: "move:make",
      from: A7,
      to: A8,
      promoteTo: QUEEN,
    })
  })

  test("confirmPromotion with knight works", () => {
    const store = new Chess(() => {}, "8/P7/8/8/8/8/8/8 w - - 0 1")
    store.makeMove(A7, A8)
    store.confirmPromotion(KNIGHT)
    const state = store.snapshot()
    expect(state.pendingPromotion).toBeNull()
    const piece = Square.decode(Board.at(state.board, A8))
    expect(piece).toEqual({ color: WHITE, type: KNIGHT })
  })

  test("cancelPromotion clears pendingPromotion", () => {
    const store = new Chess(() => {}, "8/P7/8/8/8/8/8/8 w - - 0 1")
    store.makeMove(A7, A8)
    expect(store.snapshot().pendingPromotion).not.toBeNull()
    store.cancelPromotion()
    expect(store.snapshot().pendingPromotion).toBeNull()
  })

  test("cancelPromotion with no pending does nothing", () => {
    const store = makeStore()
    store.cancelPromotion()
    expect(store.snapshot().pendingPromotion).toBeNull()
  })

  // ── confirmMove ───────────────────────────────────────

  test("clears pending state", () => {
    const store = makeStore()
    store.makeMove(E2, E4)
    expect(store.snapshot().pendingMove).not.toBeNull()
    store.confirmMove()
    expect(store.snapshot().pendingMove).toBeNull()
  })

  // ── applyMove ─────────────────────────────────────────

  test("updates board for opponent move", () => {
    const store = makeStore()
    const e4: Move = {
      piece: { color: WHITE, type: PAWN },
      from: E2,
      to: E4,
      type: MoveType(0),
      promoteTo: null,
      captured: null,
    }
    store.applyMove(e4)
    const s = store.snapshot()
    expect(s.fen).toBe(
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
    )
    expect(s.lastMove).toEqual({ from: E2, to: E4, type: MoveType(0) })
    expect(Square.isEmpty(Board.at(s.board, E2))).toBe(true)
  })

  test("when pending matches confirms own move", () => {
    const store = makeStore()
    store.makeMove(E2, E4)
    expect(store.snapshot().pendingMove).not.toBeNull()
    const e4: Move = {
      piece: { color: WHITE, type: PAWN },
      from: E2,
      to: E4,
      type: MoveType(0),
      promoteTo: null,
      captured: null,
    }
    store.applyMove(e4)
    expect(store.snapshot().pendingMove).toBeNull()
    expect(store.snapshot().fen).toBe(
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
    )
  })

  test("updates turn after applyMove", () => {
    const store = makeStore()
    expect(store.turn()).toBe(WHITE)
    const e4: Move = {
      piece: { color: WHITE, type: PAWN },
      from: E2,
      to: E4,
      type: MoveType(0),
      promoteTo: null,
      captured: null,
    }
    store.applyMove(e4)
    expect(store.turn()).toBe(BLACK)
  })

  // ── rejectMove ────────────────────────────────────────

  test("reverts board and stores reason", () => {
    const store = makeStore()
    store.makeMove(E2, E4)
    store.rejectMove("illegal-move", E2, E4)
    const s = store.snapshot()
    expect(s.fen).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    )
    expect(s.moveRejection).toBe("illegal-move")
    expect(s.pendingMove).toBeNull()
  })

  test("clears moveRejection on next makeMove", () => {
    const store = makeStore()
    store.makeMove(E2, E4)
    store.rejectMove("illegal", E2, E4)
    expect(store.snapshot().moveRejection).toBe("illegal")
    store.makeMove(E2, E4)
    expect(store.snapshot().moveRejection).toBeNull()
  })

  // ── select / clearSelection ───────────────────────────

  test("selects position and computes legal moves", () => {
    const store = makeStore()
    store.select(E2)
    const state = store.snapshot()
    expect(state.selected).toBe(E2)
    expect(state.legalMoves).toContain(E4)
    expect(state.legalMoves).toContain(E3)
  })

  test("select(null) clears selection", () => {
    const store = makeStore()
    store.select(E2)
    expect(store.snapshot().selected).toBe(E2)
    store.select(null)
    expect(store.snapshot().selected).toBeNull()
    expect(store.snapshot().legalMoves).toEqual([])
  })

  test("clearSelection clears selection", () => {
    const store = makeStore()
    store.select(E2)
    expect(store.snapshot().selected).toBe(E2)
    store.clearSelection()
    expect(store.snapshot().selected).toBeNull()
    expect(store.snapshot().legalMoves).toEqual([])
  })

  test("select sends position:select event", () => {
    const sent: object[] = []
    const store = new Chess((cmd) => sent.push(cmd))
    store.select(E2)
    expect(sent).toContainEqual({ type: "position:select", position: E2 })
  })

  test("select computes correct legal moves for black", () => {
    const store = makeStore()
    const e4: Move = {
      piece: { color: WHITE, type: PAWN },
      from: E2,
      to: E4,
      type: MoveType(0),
      promoteTo: null,
      captured: null,
    }
    store.applyMove(e4)
    store.select(E7)
    expect(store.snapshot().selected).toBe(E7)
    expect(store.snapshot().legalMoves).toEqual([E6, E5])
  })

  // ── selectAccepted / selectRejected ───────────────────

  test("selectAccepted applies server selection", () => {
    const store = makeStore()
    store.selectAccepted(E2, [E3, E4])
    const s = store.snapshot()
    expect(s.selected).toBe(E2)
    expect(s.legalMoves).toEqual([E3, E4])
  })

  test("selectRejected clears selection", () => {
    const store = makeStore()
    store.select(E2)
    store.selectRejected()
    expect(store.snapshot().selected).toBeNull()
    expect(store.snapshot().legalMoves).toEqual([])
  })

  // ── loadFen ───────────────────────────────────────────

  test("loads new position", () => {
    const store = makeStore()
    const fen = "8/8/8/8/8/8/8/8 w - - 0 1"
    store.loadFen(fen)
    expect(store.snapshot().fen).toBe(fen)
  })

  test("loadFen clears pending state", () => {
    const store = makeStore()
    store.makeMove(E2, E4)
    expect(store.snapshot().pendingMove).not.toBeNull()
    store.loadFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    expect(store.snapshot().pendingMove).toBeNull()
  })

  // ── setClock ──────────────────────────────────────────

  test("setClock updates clock and clockReceivedAt", () => {
    const store = makeStore()
    const now = performance.now()
    store.setClock({ whiteMs: 100000, blackMs: 90000, active: WHITE }, now)
    const s = store.snapshot()
    expect(s.clock).toEqual({ whiteMs: 100000, blackMs: 90000, active: WHITE })
    expect(s.clockReceivedAt).toBe(now)
  })

  test("setClock with null clears clock", () => {
    const store = makeStore()
    store.setClock(
      { whiteMs: 100000, blackMs: 90000, active: WHITE },
      performance.now()
    )
    store.setClock(null, null)
    expect(store.snapshot().clock).toBeNull()
    expect(store.snapshot().clockReceivedAt).toBeNull()
  })

  // ── turn ──────────────────────────────────────────────

  test("returns WHITE initially", () => {
    expect(makeStore().turn()).toBe(WHITE)
  })

  test("flips after move", () => {
    const store = makeStore()
    const e4: Move = {
      piece: { color: WHITE, type: PAWN },
      from: E2,
      to: E4,
      type: MoveType(0),
      promoteTo: null,
      captured: null,
    }
    store.applyMove(e4)
    expect(store.turn()).toBe(BLACK)
  })

  test("reverts after reject undoes", () => {
    const store = makeStore()
    store.makeMove(E2, E4)
    expect(store.turn()).toBe(BLACK)
    store.rejectMove("no", E2, E4)
    expect(store.turn()).toBe(WHITE)
  })

  // ── isCheck ───────────────────────────────────────────

  test("returns false initially", () => {
    expect(makeStore().isCheck()).toBe(false)
  })

  test("returns true when king is in check", () => {
    const store = new Chess(() => {}, "4k3/8/8/8/8/8/8/r3K3 w - - 0 1")
    expect(store.isCheck()).toBe(true)
  })

  test("resolves after moving out of check", () => {
    const store = new Chess(() => {}, "4k3/8/8/8/8/8/8/r3K3 w - - 0 1")
    expect(store.isCheck()).toBe(true)
    store.makeMove(E1, E2)
    expect(store.isCheck()).toBe(false)
  })

  // ── status ────────────────────────────────────────────

  test("returns IN_PROGRESS initially", () => {
    const result = makeStore().status()
    expect(result.status).toBe(IN_PROGRESS)
    expect(result.hasWinner).toBe(false)
  })

  test("returns CHECKMATE after fool's mate", () => {
    const store = makeStore()
    const g4: Move = {
      piece: { color: WHITE, type: PAWN },
      from: G2,
      to: G4,
      type: MoveType(0),
      promoteTo: null,
      captured: null,
    }
    const e5: Move = {
      piece: { color: BLACK, type: PAWN },
      from: E7,
      to: E5,
      type: MoveType(0),
      promoteTo: null,
      captured: null,
    }
    const f3: Move = {
      piece: { color: WHITE, type: PAWN },
      from: F2,
      to: F3,
      type: MoveType(0),
      promoteTo: null,
      captured: null,
    }
    const qh4: Move = {
      piece: { color: BLACK, type: QUEEN },
      from: D8,
      to: H4,
      type: MoveType(0),
      promoteTo: null,
      captured: null,
    }

    store.applyMove(g4)
    store.applyMove(e5)
    store.applyMove(f3)
    store.applyMove(qh4)

    const result = store.status()
    expect(result.hasWinner).toBe(true)
    expect(result.status).toBe(CHECKMATE)
  })
})
