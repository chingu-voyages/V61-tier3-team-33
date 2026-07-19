import type { ChessConfig } from "./config";
import { resolveConfig } from "./config";
import { Board as CoreBoard, Square } from "./core/board";
import type { GameResult } from "./core/game";
import { IN_PROGRESS } from "./core/game";
import { MoveHash } from "./core/hash";
import type { Move } from "./core/move";
import { PROMOTION } from "./core/move";
import type { Piece, PieceType } from "./core/piece";
import { PieceColor, QUEEN } from "./core/piece";
import { Position } from "./core/position";
import type { ChessState, TurnContext } from "./core/state";
import { MoveContext, TurnContext as TC } from "./core/state";
import { FENError, IllegalMoveError, InvalidSquareError, NothingToUndoError } from "./errors";
import { SAN } from "./parser/san";

export { FENError, IllegalMoveError, InvalidSquareError, NothingToUndoError };
export type { ChessConfig } from "./config";
export { STARTING_FEN } from "./config";

/**
 * Chess is the top-level game orchestrator. It owns all mutable state
 * (board position, Zobrist hash) and coordinates every subsystem: move
 * generation (engine), position hashing (hasher), draw/checkmate detection
 * (rules), move history (history), and repetition tracking (tracker).
 *
 * All subsystems have sensible defaults - `new Chess()` starts a standard
 * game from the opening position with no further configuration needed.
 *
 * makeMove and undoMove maintain a strict ordering of subsystem calls.
 * Do not interleave them with direct engine apply/undo calls - doing so
 * will desync the hash, tracker, and history from the board.
 */
export class Chess {
  private ctx: TurnContext;
  private hash: bigint;
  private parser;

  private readonly engine;
  private readonly hasher;
  private readonly rules;
  private readonly tracker;
  private readonly history;

  constructor(config: ChessConfig = {}) {
    const { fen, engine, hasher, rules, parser, tracker, history } = resolveConfig(config);

    this.engine = engine;
    this.hasher = hasher;
    this.rules = rules;
    this.parser = parser;
    this.tracker = tracker;
    this.history = history;

    const [ctx, err] = parser.decode(fen);
    if (err !== null) {
      throw new FENError(err.message);
    }

    this.ctx = ctx;
    this.hash = this.hasher.initHash(ctx);
    this.tracker.record(this.hash);
  }

  /** Returns the piece on `square`, or `null` if the square is empty. */
  pieceAt(square: Position): Piece | null {
    const s = CoreBoard.at(this.ctx.board, square);
    if (Square.isEmpty(s)) return null;
    return { type: Square.pieceType(s), color: Square.pieceColor(s) };
  }

  /** Returns whose turn it is. */
  sideToMove(): PieceColor {
    return this.ctx.sideToMove;
  }

  /**
   * Returns true if the side to move is currently in check.
   * Useful for highlighting the king square in the UI.
   */
  isInCheck(): boolean {
    const side = this.ctx.sideToMove;
    const enemy = PieceColor.opponent(side);
    const kingPos = MoveContext.sideOf(this.ctx, side).kingPosition;
    return this.engine.isSquareAttacked(kingPos, enemy, this.ctx);
  }

  /** Returns true if the game has ended (checkmate or any draw). */
  isOver(): boolean {
    return this.gameResult().status !== IN_PROGRESS;
  }

  /**
   * Returns all legal moves for the piece on `from`.
   * Returns an empty array if the square is empty, opponent's, or has no legal moves.
   */
  legalMovesFrom(from: Position): Move[] {
    return this.engine.getLegalMoves([], from, this.ctx);
  }

  /**
   * Returns a map of every from-square to its legal destination squares.
   * The UI can use this to know which squares are draggable and where they
   * can go, without calling legalMovesFrom for every square on each render.
   */
  legalMovesMap(): Map<Position, Position[]> {
    const all = this.engine.getAllLegalMoves([], this.ctx);
    const map = new Map<Position, Position[]>();
    for (const move of all) {
      const dests = map.get(move.from);
      if (dests) {
        dests.push(move.to);
      } else {
        map.set(move.from, [move.to]);
      }
    }
    return map;
  }

  /**
   * Returns true if moving from `from` to `to` is legal in the current position.
   * Useful for validating a drag-and-drop before constructing the full Move object.
   */
  isLegalSquare(from: Position, to: Position): boolean {
    return this.legalMovesFrom(from).some((m) => m.to === to);
  }

  /**
   * Returns true if moving from `from` to `to` is legal in the current position.
   * Both arguments are algebraic notation strings (e.g. `"e2"`, `"e4"`).
   * Returns false for invalid square strings rather than throwing.
   */
  isLegalMove(from: string, to: string): boolean {
    const fromPos = Position.parse(from);
    const toPos = Position.parse(to);
    if (!fromPos || !toPos) return false;
    return this.isLegalSquare(fromPos, toPos);
  }

  /** Returns true if there is at least one move to undo. */
  canUndo(): boolean {
    return this.history.len() > 0;
  }

  /** Returns the number of half-moves (plies) played so far. */
  plyCount(): number {
    return this.history.len();
  }

  /** Returns all moves played so far, oldest first. */
  moveHistory(): Move[] {
    return this.history.all().map((snap) => snap.move);
  }

  /** Serializes the current position to a FEN string. */
  toFen(): string {
    return this.parser.encode(this.ctx);
  }

  /** Serializes the current game into a flat snapshot suitable for persistence or transmission. */
  state(): ChessState {
    return { ...TC.copy(this.ctx), hash: this.hash };
  }

  /** Returns a deep copy of the current board context. */
  getContext(): TurnContext {
    return TC.copy(this.ctx);
  }

  /** Returns the Zobrist hash of the current position. */
  getHash(): bigint {
    return this.hash;
  }

  /** Evaluates all termination conditions cheapest-first and returns the current game result. */
  gameResult(): GameResult {
    return this.rules.getGameResult(this.ctx, this.engine, this.tracker, this.hash);
  }

  /**
   * Returns the king's position for the given color.
   * Useful for highlighting the king square (especially when in check).
   */
  kingPosition(color: PieceColor): Position {
    return MoveContext.sideOf(this.ctx, color).kingPosition;
  }

  /** Returns the last move played, or `null` if no moves have been made. */
  lastMove(): Move | null {
    const snap = this.history.peek();
    return snap !== null ? snap.move : null;
  }

  /**
   * Returns the half-move clock (moves since last pawn move or capture).
   * Useful for showing progress toward the 50-move rule draw.
   */
  halfMoveClock(): number {
    return this.ctx.halfMoveClock;
  }

  /**
   * Returns the piece types a pawn can promote to when moving from `from` to `to`.
   * Returns an empty array if the move is not a promotion.
   * Use this to decide whether to show a promotion picker before calling makeMove.
   */
  legalPromotions(from: Position, to: Position): PieceType[] {
    return this.legalMovesFrom(from)
      .filter((m) => m.to === to && m.type === PROMOTION && m.promoteTo !== null)
      .map((m) => m.promoteTo as PieceType);
  }

  /**
   * Finds, applies, and encodes a move in one call.
   *
   * Captures the pre-move context (for SAN disambiguation), finds the legal
   * move, applies it via `makeMove`, then generates SAN from the post-move
   * position (for check/checkmate). The returned `Move` has `san` populated;
   * the history snapshot carries it too (same object reference), so
   * `undoMove()` returns moves with SAN.
   *
   * For promotions, pass the desired piece type as `promoteTo` (defaults to QUEEN).
   * Throws `IllegalMoveError` if no legal move exists for the given squares.
   */
  move(from: Position, to: Position, promoteTo: PieceType = QUEEN): Move {
    const preMoveCtx = TC.copy(this.ctx);

    const legalMove =
      this.legalMovesFrom(from).find((m) => m.to === to && (m.type !== PROMOTION || m.promoteTo === promoteTo)) ?? null;

    if (legalMove === null) {
      throw new IllegalMoveError();
    }

    this.makeMove(legalMove);

    // Generate SAN from the post-move position.
    const opponentColor = PieceColor.opponent(legalMove.piece.color);
    const isCheck = this.engine.isSquareAttacked(
      MoveContext.sideOf(this.ctx, opponentColor).kingPosition,
      legalMove.piece.color,
      this.ctx,
    );

    const isCheckmate = isCheck && this.gameResult().status !== IN_PROGRESS;
    legalMove.san = SAN.encode(legalMove, preMoveCtx, isCheck, isCheckmate);

    return legalMove;
  }

  /**
   * Validates and applies move to the current position.
   * Returns the applied move so callers can inspect or broadcast it.
   * Throws IllegalMoveError if the move is not legal.
   *
   * Apply first (so ctx reflects the new position), then hash (which needs the
   * post-apply castling rights), then tracker and history.
   */
  makeMove(move: Move): Move {
    if (!this.engine.isLegalMove(move, this.ctx)) {
      throw new IllegalMoveError();
    }

    const snap = this.engine.apply(this.ctx, move);

    this.ctx.sideToMove = PieceColor.opponent(this.ctx.sideToMove);

    const moveHash = MoveHash.create(snap, this.ctx);
    this.hash = this.hasher.hash(this.hash, moveHash);

    this.tracker.record(this.hash);
    this.history.push(snap);

    return move;
  }

  /**
   * Reverts the last move and returns it.
   * Throws NothingToUndoError if the history is empty.
   *
   * Tracker and hash are reverted before the board - MoveHash.create needs ctx
   * still in the post-move state to read the castling rights that were active
   * when the move was hashed.
   */
  undoMove(): Move {
    const snap = this.history.pop();
    if (snap === null) {
      throw new NothingToUndoError();
    }

    this.tracker.undo(this.hash);

    const moveHash = MoveHash.create(snap, this.ctx);
    this.hash = this.hasher.hash(this.hash, moveHash);

    this.engine.undo(this.ctx, snap);

    this.ctx.sideToMove = PieceColor.opponent(this.ctx.sideToMove);

    return snap.move;
  }
}
