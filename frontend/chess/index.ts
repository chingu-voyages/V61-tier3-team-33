import type { Position } from "./core/position"
import type { Move, MoveType } from "./core/move"
import type { TurnContext } from "./core/state"
import type { Board as BoardType } from "./core/board"
import type { GameResult } from "./core/game"
import { Board } from "./core/board"
import { PieceColor, PieceType, WHITE, BLACK } from "./core/piece"
import { MoveContext, TurnContext as TC } from "./core/state"
import { getDefaultEngine, type DefaultEngine } from "./engine/default"
import { getDefaultRules, type DefaultRules } from "./rules/default"
import { FEN } from "./fen"
import type { ITracker } from "./rules/rules"
import { PositionTracker } from "./tracker/position"
import { getDefaultHasher, type IHasher } from "./hasher"
import { MoveHash } from "./core/hash"
import type { ClockState } from "@/socket/types"
import type { Snapshot } from "./core/history"

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
  setOnLocalMove(cb: ((move: Move) => void) | null): void
  applyMove(move: Move): void
  rejectMove(reason: string, from: Position, to: Position): void
  selectAccepted(position: Position, legalMoves: Position[]): void
  selectRejected(): void
  loadFen(fen: string): void
  setClock(clock: ClockState | null, receivedAt: number | null): void
  turn(): PieceColor
  isCheck(): boolean
  status(): GameResult
}

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

export class Chess implements ChessStore {
  private ctx: TurnContext
  private engine: DefaultEngine
  private rules: DefaultRules
  private tracker: ITracker
  private hasher: IHasher
  private currentHash: bigint

  private state: ChessState
  private listeners = new Set<Listener>()
  private pendingSnap: { from: Position; to: Position; snap: Snapshot } | null =
    null
  private send: (cmd: object) => void
  private onLocalMove: ((move: Move) => void) | null = null

  constructor(send: (cmd: object) => void, fen?: string) {
    this.send = send
    this.ctx = TC.create()
    this.engine = getDefaultEngine()
    this.rules = getDefaultRules() as DefaultRules
    this.tracker = new PositionTracker()
    this.hasher = getDefaultHasher()
    this.currentHash = BigInt(0)
    this.loadFenInternal(fen ?? STARTING_FEN)
    this.state = this.createInitialState()
  }

  // React integration

  snapshot = (): ChessState => this.state

  subscribe = (cb: Listener): (() => void) => {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  // Local move

  makeMove = (from: Position, to: Position): void => {
    if (this.pendingSnap) return
    const moves = this.legalMoves(from)
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

  confirmPromotion = (promoteTo: PieceType): void => {
    if (!this.state.pendingPromotion) return
    const { from, to } = this.state.pendingPromotion
    const moves = this.legalMoves(from)
    const move = moves.find((m) => m.to === to && m.promoteTo === promoteTo)
    if (!move) return
    this.applyAndSend(from, to, move)
  }

  cancelPromotion = (): void => {
    this.setState({ pendingPromotion: null })
  }

  /**
   * Register a callback fired synchronously whenever a move is applied
   * locally (optimistically), before any server round-trip. Used to play
   * move/capture sounds instantly instead of waiting for MOVE_MADE.
   */
  setOnLocalMove = (cb: ((move: Move) => void) | null): void => {
    this.onLocalMove = cb
  }

  // Server sync

  confirmMove = (): void => {
    this.pendingSnap = null
    this.setState({ pendingMove: null })
  }

  applyMove = (move: Move): void => {
    if (
      this.pendingSnap &&
      this.pendingSnap.from === move.from &&
      this.pendingSnap.to === move.to
    ) {
      this.pendingSnap = null
      this.setState({ pendingMove: null })
      return
    }
    this.applyLocal(move)
    this.setState({
      fen: this.fen(),
      board: Board.copy(this.board()),
      lastMove: { from: move.from, to: move.to, type: move.type },
      moveSeq: this.state.moveSeq + 1,
      selected: null,
      legalMoves: [],
    })
  }

  rejectMove = (reason: string, _from: Position, _to: Position): void => {
    if (this.pendingSnap) {
      this.undoLocal(this.pendingSnap.snap)
      this.pendingSnap = null
    }
    this.setState({
      fen: this.fen(),
      board: Board.copy(this.board()),
      moveRejection: reason,
      pendingMove: null,
      selected: null,
      legalMoves: [],
    })
  }

  // Selection

  select = (position: Position | null): void => {
    if (position === null) {
      this.setState({ selected: null, legalMoves: [] })
      return
    }
    const legalMoves = this.legalMoves(position).map((m) => m.to)
    this.setState({ selected: position, legalMoves })
    this.send({ type: "position:select", position })
  }

  clearSelection = (): void => {
    this.setState({ selected: null, legalMoves: [] })
  }

  selectAccepted = (position: Position, legalMoves: Position[]): void => {
    this.setState({ selected: position, legalMoves })
  }

  selectRejected = (): void => {
    this.setState({ selected: null, legalMoves: [] })
  }

  // Board state

  loadFen = (fen: string): void => {
    this.loadFenInternal(fen)
    this.pendingSnap = null
    this.setState({
      fen: this.fen(),
      board: Board.copy(this.board()),
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

  // Queries

  turn = (): PieceColor => this.ctx.sideToMove

  isCheck = (): boolean => {
    return this.engine.isSquareAttacked(
      MoveContext.sideOf(this.ctx, this.ctx.sideToMove).kingPosition,
      this.ctx.sideToMove === WHITE ? BLACK : WHITE,
      this.ctx
    )
  }

  status = (): GameResult => {
    return this.rules.getGameResult(
      this.ctx,
      this.engine,
      this.tracker,
      this.currentHash
    )
  }

  // Internals

  private loadFenInternal(fen: string): void {
    this.ctx = FEN.decode(fen)
    this.currentHash = this.hasher.initHash(this.ctx)
    this.tracker.record(this.currentHash)
  }

  private createInitialState(): ChessState {
    return {
      fen: FEN.encode(this.ctx),
      board: Board.copy(this.ctx.board),
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

  private fen(): string {
    return FEN.encode(this.ctx)
  }

  private board(): Board {
    return this.ctx.board
  }

  private legalMoves(from: Position): Move[] {
    return this.engine.getLegalMoves([], from, this.ctx)
  }

  private applyLocal(move: Move): Snapshot {
    const snap = this.engine.apply(this.ctx, move)
    this.ctx.sideToMove = PieceColor.opponent(this.ctx.sideToMove)
    const moveHash = MoveHash.create(snap, this.ctx)
    this.currentHash = this.hasher.hash(this.currentHash, moveHash)
    this.tracker.record(this.currentHash)
    return snap
  }

  private undoLocal(snap: Snapshot): void {
    this.ctx.sideToMove = PieceColor.opponent(this.ctx.sideToMove)
    const moveHash = MoveHash.create(snap, this.ctx)
    this.currentHash = this.hasher.hash(this.currentHash, moveHash)
    this.tracker.undo(this.currentHash)
    this.engine.undo(this.ctx, snap)
  }

  private applyAndSend(from: Position, to: Position, move: Move): void {
    const snap = this.applyLocal(move)
    this.pendingSnap = { from, to, snap }
    this.setState({
      fen: this.fen(),
      board: Board.copy(this.board()),
      lastMove: { from, to, type: move.type },
      moveSeq: this.state.moveSeq + 1,
      pendingMove: { from, to },
      selected: null,
      legalMoves: [],
      moveRejection: null,
      pendingPromotion: null,
    })
    this.onLocalMove?.(move)
    const cmd: Record<string, unknown> = { type: "move:make", from, to }
    if (move.promoteTo !== null) {
      cmd.promoteTo = move.promoteTo
    }
    this.send(cmd)
  }

  private notify(): void {
    for (const cb of this.listeners) cb()
  }

  private setState(partial: Partial<ChessState>): void {
    this.state = { ...this.state, ...partial }
    this.notify()
  }
}
