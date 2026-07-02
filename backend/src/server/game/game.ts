import { Chess } from "../../chess";
import { IllegalMoveError, NothingToUndoError } from "../../chess/errors";
import type { Move } from "../../chess/core/move";

import {
  WHITE,
  BLACK,
  WAITING,
  ACTIVE,
  FINISHED,
  RULES,
  IN_PROGRESS,
  type EndReason,
  type GameOutcome,
  type GameSnapshot,
  type Lifecycle,
  type MoveInput,
  type Mode,
  type PieceColor,
  type PieceType,
} from "../domain/types";

import {
  ok,
  err,
  NOT_YOUR_TURN,
  ILLEGAL_MOVE,
  GAME_OVER,
  SQUARE_EMPTY,
  NO_HISTORY,
  ROOM_FULL,
  INVALID_MODE,
  type Result,
  type MoveError,
  type UndoError,
  type JoinError,
} from "../domain/result";

import type { Occupant } from "../occupant/occupant";
import type { Publisher } from "../bus/bus";
import { Mutex } from "../util/mutex";

import { MOVE_MADE } from "../protocol/events";
import type { Notification } from "../protocol/events";

/** A single chess match: two color slots, one engine, one lifecycle. */
export class Game {
  status: Lifecycle = WAITING;
  endReason: EndReason | null = null;
  readonly createdAt: number = Date.now();
  finishedAt: number | null = null;

  private chess: Chess = new Chess();
  private slots = new Map<PieceColor, Occupant>();
  private lock = new Mutex();

  constructor(
    readonly id: string,
    readonly mode: Mode,
    private publisher: Publisher,
    private onActivated?: () => void,
  ) {}

  get isEmpty(): boolean {
    return this.slots.size === 0;
  }

  /** True once both color slots are filled. */
  get isFull(): boolean {
    return this.slots.size >= 2;
  }

  get isWaiting(): boolean {
    return this.status === WAITING;
  }

  get isActive(): boolean {
    return this.status === ACTIVE;
  }

  /** True once the game has ended, for any reason. */
  get isFinished(): boolean {
    return this.status === FINISHED;
  }

  /** The color a new joiner would take, or null if the game is already full. */
  nextColor(): PieceColor | null {
    if (this.isFull) return null;
    return this.slots.has(WHITE) ? BLACK : WHITE;
  }

  /** The occupant in a color slot, or null if that slot is empty. */
  getOccupant(color: PieceColor): Occupant | null {
    return this.slots.get(color) ?? null;
  }

  /** The player id in a color slot, or null if that slot is empty. */
  playerIdByColor(color: PieceColor): string | null {
    return this.slots.get(color)?.playerId ?? null;
  }

  /** Seats an occupant into a color slot; the game goes ACTIVE once both are filled. */
  join(color: PieceColor, occupant: Occupant): Result<void, JoinError> {
    if (this.status === FINISHED) return err(INVALID_MODE);
    if (this.slots.has(color)) return err(ROOM_FULL);

    this.slots.set(color, occupant);
    if (this.isFull) {
      this.status = ACTIVE;
      this.onActivated?.();
    }

    return ok();
  }

  /** Applies a move for `color`, publishing MOVE_MADE on success. */
  async move(
    color: PieceColor,
    input: MoveInput,
  ): Promise<Result<Move, MoveError>> {
    return this.lock.run(async () => {
      if (this.status !== ACTIVE) return err(GAME_OVER);
      if (this.chess.sideToMove() !== color) return err(NOT_YOUR_TURN);
      if (this.chess.isOver()) return err(GAME_OVER);
      if (this.chess.pieceAt(input.from) === null) return err(SQUARE_EMPTY);

      try {
        const applied = this.chess.move(input.from, input.to, input.promoteTo);
        const outcome = this.settleIfOver();

        this.publisher.emit(this.id, {
          type: MOVE_MADE,
          roomId: this.id,
          by: color,
          move: applied,
          isCheck: this.chess.isInCheck(),
          isGameOver: outcome !== null,
          result: outcome,
          clock: null,
        } as Notification);

        return ok(applied);
      } catch (e) {
        if (e instanceof IllegalMoveError) return err(ILLEGAL_MOVE);
        throw e;
      }
    });
  }

  /** Undoes the last move, reopening the game if it had just finished. */
  async undo(): Promise<Result<Move, UndoError>> {
    return this.lock.run(async () => {
      if (this.status === WAITING) return err(NO_HISTORY);

      try {
        const undone = this.chess.undoMove();
        if (this.status === FINISHED) {
          this.status = ACTIVE;
          this.finishedAt = null;
        }

        return ok(undone);
      } catch (e) {
        if (e instanceof NothingToUndoError) return err(NO_HISTORY);
        throw e;
      }
    });
  }

  /** A full, serializable view of the current position — for join/sync/undo. */
  snapshot(): GameSnapshot {
    const history = this.chess.moveHistory();
    const { capturedByWhite, capturedByBlack } = this.splitCaptures(history);

    return {
      fen: this.chess.toFen(),
      isCheck: this.chess.isInCheck(),
      result: this.outcome(),
      history: history.map((m) => m.san ?? ""),
      capturedByWhite,
      capturedByBlack,
    };
  }

  /**
   * If the engine now reports the game as over, marks this game FINISHED
   * and returns the resulting outcome. Returns null while still in progress.
   */
  private settleIfOver(): GameOutcome | null {
    const engineResult = this.chess.gameResult();
    if (engineResult.status === IN_PROGRESS) return null;

    this.status = FINISHED;
    this.endReason = RULES;
    this.finishedAt = Date.now();

    return this.outcome(engineResult);
  }

  /** The current outcome, built from a given (or freshly-fetched) engine result. */
  private outcome(engineResult = this.chess.gameResult()): GameOutcome {
    return {
      status: engineResult.status,
      winner: engineResult.winner,
      hasWinner: engineResult.hasWinner,
      drawReason: engineResult.drawReason,
      reason: this.endReason ?? RULES,
    };
  }

  /** Splits captured pieces out of move history by which color captured them. */
  private splitCaptures(history: readonly Move[]): {
    capturedByWhite: PieceType[];
    capturedByBlack: PieceType[];
  } {
    const capturedByWhite: PieceType[] = [];
    const capturedByBlack: PieceType[] = [];

    for (const m of history) {
      if (!m.captured) continue;
      (m.piece.color === WHITE ? capturedByWhite : capturedByBlack).push(
        m.captured.type,
      );
    }

    return { capturedByWhite, capturedByBlack };
  }
}
