import { Chess } from "./index"
import type { Position } from "./core/position"
import type { Move, MoveType } from "./core/move"
import type { Snapshot } from "./core/history"
import { Board, type Board as BoardType } from "./core/board"
import type { ClockState } from "@/socket/types"
import type { PieceType } from "./core/piece"

export interface ChessState {
  fen: string
  board: BoardType
  clock: ClockState | null
  clockReceivedAt: number | null
  lastMove: { from: Position; to: Position; type: MoveType } | null
  moveSeq: number
  selected: Position | null
  legalMoves: Position[]
  moveRejection: string | null
  pendingMove: { from: Position; to: Position } | null
  pendingPromotion: { from: Position; to: Position } | null
}

type Listener = () => void

export interface ChessStore {
  snapshot(): ChessState
  subscribe(cb: Listener): () => void
  makeMove(from: Position, to: Position): void
  select(position: Position | null): void
  clearSelection(): void
  confirmMove(): void
  confirmPromotion(promoteTo: PieceType): void
  cancelPromotion(): void
  applyMove(move: Move): void
  rejectMove(reason: string, from: Position, to: Position): void
  selectAccepted(position: Position, legalMoves: Position[]): void
  selectRejected(): void
  loadFen(fen: string): void
  setClock(clock: ClockState | null, receivedAt: number | null): void
}

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

export class ChessStoreImpl implements ChessStore {
  private state: ChessState
  private listeners = new Set<Listener>()
  private chess: Chess
  private pending: { from: Position; to: Position; snap: Snapshot } | null =
    null
  private sendFn: (cmd: object) => void

  constructor(send: (cmd: object) => void, fen?: string) {
    this.sendFn = send
    this.chess = new Chess(fen ?? STARTING_FEN)
    this.state = this.createInitialState()
  }

  private createInitialState(): ChessState {
    return {
      fen: this.chess.fen(),
      board: Board.copy(this.chess.board()),
      clock: null,
      clockReceivedAt: null,
      lastMove: null,
      moveSeq: 0,
      selected: null,
      legalMoves: [],
      moveRejection: null,
      pendingMove: null,
      pendingPromotion: null,
    }
  }

  private notify() {
    for (const cb of this.listeners) cb()
  }

  private setState(partial: Partial<ChessState>) {
    this.state = { ...this.state, ...partial }
    this.notify()
  }

  private snapshotFromChess() {
    return {
      fen: this.chess.fen(),
      board: Board.copy(this.chess.board()),
    }
  }

  snapshot = (): ChessState => this.state

  subscribe = (cb: Listener): (() => void) => {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  makeMove = (from: Position, to: Position): void => {
    if (this.pending) return
    const moves = this.chess.legalMoves(from)
    const promotionMoves = moves.filter(
      (m) => m.to === to && m.promoteTo !== null
    )
    if (promotionMoves.length > 0) {
      this.setState({ pendingPromotion: { from, to } })
      return
    }
    const move = moves.find((m) => m.to === to)
    if (!move) return
    this.applyAndSend(from, to, move)
  }

  private applyAndSend(from: Position, to: Position, move: Move): void {
    const snap = this.chess.apply(move)
    this.pending = { from, to, snap }
    this.setState({
      ...this.snapshotFromChess(),
      lastMove: { from, to, type: move.type },
      moveSeq: this.state.moveSeq + 1,
      pendingMove: { from, to },
      selected: null,
      legalMoves: [],
      moveRejection: null,
      pendingPromotion: null,
    })
    const cmd: Record<string, unknown> = { type: "move:make", from, to }
    if (move.promoteTo !== null) {
      cmd.promoteTo = move.promoteTo
    }
    this.sendFn(cmd)
  }

  confirmPromotion = (promoteTo: PieceType): void => {
    if (!this.state.pendingPromotion) return
    const { from, to } = this.state.pendingPromotion
    const moves = this.chess.legalMoves(from)
    const move = moves.find((m) => m.to === to && m.promoteTo === promoteTo)
    if (!move) return
    this.applyAndSend(from, to, move)
  }

  cancelPromotion = (): void => {
    this.setState({ pendingPromotion: null })
  }

  select = (position: Position | null): void => {
    if (position === null) {
      this.setState({ selected: null, legalMoves: [] })
      return
    }
    const legalMoves = this.chess.legalMoves(position).map((m) => m.to)
    this.setState({ selected: position, legalMoves })
    this.sendFn({ type: "position:select", position })
  }

  clearSelection = (): void => {
    this.setState({ selected: null, legalMoves: [] })
  }

  confirmMove = (): void => {
    this.pending = null
    this.setState({ pendingMove: null })
  }

  applyMove = (move: Move): void => {
    if (
      this.pending &&
      this.pending.from === move.from &&
      this.pending.to === move.to
    ) {
      this.pending = null
      this.setState({ pendingMove: null })
      return
    }
    this.chess.apply(move)
    this.setState({
      ...this.snapshotFromChess(),
      lastMove: { from: move.from, to: move.to, type: move.type },
      moveSeq: this.state.moveSeq + 1,
      selected: null,
      legalMoves: [],
    })
  }

  rejectMove = (reason: string, _from: Position, _to: Position): void => {
    if (this.pending) {
      this.chess.undo(this.pending.snap)
      this.pending = null
    }
    this.setState({
      ...this.snapshotFromChess(),
      moveRejection: reason,
      pendingMove: null,
      selected: null,
      legalMoves: [],
    })
  }

  selectAccepted = (position: Position, legalMoves: Position[]): void => {
    this.setState({ selected: position, legalMoves })
  }

  selectRejected = (): void => {
    this.setState({ selected: null, legalMoves: [] })
  }

  loadFen = (fen: string): void => {
    this.chess.load(fen)
    this.pending = null
    this.setState({
      ...this.snapshotFromChess(),
      lastMove: null,
      moveSeq: 0,
      selected: null,
      legalMoves: [],
      moveRejection: null,
      pendingMove: null,
    })
  }

  setClock = (clock: ClockState | null, receivedAt: number | null): void => {
    this.setState({ clock, clockReceivedAt: receivedAt })
  }
}
