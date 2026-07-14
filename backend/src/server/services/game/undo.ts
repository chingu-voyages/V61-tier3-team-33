import { logger as rootLogger } from "../../../logging/logger";
import { Notifications } from "../../protocol/events";
import type { GameReader } from "../../store/game/game-store";
import {
  err,
  GAME_NOT_FOUND,
  type GameError,
  NO_HISTORY,
  NOT_ALLOWED,
  NOT_YOUR_TURN,
  ok,
  PENDING_CONFLICT,
  type Result,
  UNDO_INACTIVE,
} from "../../types";
import { BLACK, type PieceColor, type PlayerContext, WHITE } from "../../types";
import { CONSENT_ACCEPT, CONSENT_DECLINE, CONSENT_EXPIRE, CONSENT_REQUEST } from "../../types/consent";
import type { ConsentManager } from "../../util/consent";

const log = rootLogger.child({ module: "UndoCommand" });

export class UndoCommand {
  /** Per-room: moveSeq of the most recently resolved request, or null. */
  private lastResolvedSeq = new Map<string, number>();

  /** Per-room: moveSeq stamped on the current pending request. */
  private pendingStamps = new Map<string, number>();

  constructor(
    private games: GameReader,
    private consent: ConsentManager<string, PieceColor>,
  ) {}

  private resolve(roomId: string): void {
    const stamped = this.pendingStamps.get(roomId);
    if (stamped !== undefined) {
      this.lastResolvedSeq.set(roomId, stamped);
      this.pendingStamps.delete(roomId);
    }
  }

  request(ctx: PlayerContext): Result<void, GameError> {
    log.info("[UndoCommand.request:start]", { playerId: ctx.playerId, color: ctx.color });

    // game may already be gone (swept from memory)
    const game = this.games.get(ctx.roomId!);
    if (!game) {
      log.warn("[UndoCommand.request:game-not-found]", { playerId: ctx.playerId, roomId: ctx.roomId });
      return err(GAME_NOT_FOUND);
    }

    // validate game is active
    if (!game.isActive) {
      log.warn("[UndoCommand.request:game-inactive]", { playerId: ctx.playerId });
      return err(UNDO_INACTIVE);
    }

    // nothing to undo yet
    if (!game.canUndo) {
      log.warn("[UndoCommand.request:no-history]", { playerId: ctx.playerId });
      return err(NO_HISTORY);
    }

    // only the player who just moved may request
    if (ctx.color === game.turn) {
      log.warn("[UndoCommand.request:not-your-turn]", { playerId: ctx.playerId });
      return err(NOT_YOUR_TURN);
    }

    // ratchet check — moveSeq must have advanced past lastResolvedSeq
    const resolved = this.lastResolvedSeq.get(game.id) ?? -Infinity;
    if (game.moveSeq <= resolved) {
      log.warn("[UndoCommand.request:ratchet-blocked]", { playerId: ctx.playerId, moveSeq: game.moveSeq, resolved });
      return err(NOT_ALLOWED);
    }

    // transition consent state
    if (!this.consent.transition(game.id, CONSENT_REQUEST, ctx.color!)) {
      log.warn("[UndoCommand.request:conflict]", { playerId: ctx.playerId });
      return err(PENDING_CONFLICT);
    }

    // stamp the request with the current moveSeq
    this.pendingStamps.set(game.id, game.moveSeq);
    const opponent = ctx.color === WHITE ? BLACK : WHITE;
    game.broadcast(Notifications.undoRequested(game.id, ctx.color!, Date.now() + 30_000));
    log.info("[UndoCommand.request:requested]", { playerId: ctx.playerId, roomId: game.id, opponent });
    return ok();
  }

  async accept(ctx: PlayerContext): Promise<Result<void, GameError>> {
    log.info("[UndoCommand.accept:start]", { playerId: ctx.playerId, color: ctx.color });

    const game = this.games.get(ctx.roomId!);
    if (!game) {
      log.warn("[UndoCommand.accept:game-not-found]", { playerId: ctx.playerId, roomId: ctx.roomId });
      return err(GAME_NOT_FOUND);
    }

    // transition consent state
    if (!this.consent.transition(game.id, CONSENT_ACCEPT, ctx.color!)) {
      log.warn("[UndoCommand.accept:conflict]", { playerId: ctx.playerId });
      return err(PENDING_CONFLICT);
    }

    // defense-in-depth: verify stamped moveSeq still matches current game.moveSeq
    const stamped = this.pendingStamps.get(game.id);
    if (stamped === undefined || stamped !== game.moveSeq) {
      log.warn("[UndoCommand.accept:stale-stamp]", { playerId: ctx.playerId, stamped, moveSeq: game.moveSeq });
      return err(PENDING_CONFLICT);
    }

    // advance the ratchet
    this.resolve(game.id);

    const result = await game.undo();
    if (!result.ok) {
      log.warn("[UndoCommand.accept:undo-failed]", { playerId: ctx.playerId, error: result.error });
      return err(result.error);
    }

    log.info("[UndoCommand.accept:applied]", { playerId: ctx.playerId, roomId: game.id });
    game.broadcast(Notifications.undoApplied(game.id, game.snapshot()));
    return ok();
  }

  /**
   * Force-clear a pending undo request when a new move is played
   * Broadcasts `undo:invalidated` to the requester only.
   */
  invalidate(roomId: string): void {
    if (!this.consent.isPending(roomId)) return;

    const requester = this.consent.requester(roomId);
    this.consent.clear(roomId);
    this.resolve(roomId);

    if (requester !== null) {
      const game = this.games.get(roomId);
      if (game) {
        game.notify(requester, Notifications.undoInvalidated(roomId));
      }
    }
  }

  decline(ctx: PlayerContext): Result<void, GameError> {
    log.info("[UndoCommand.decline:start]", { playerId: ctx.playerId, color: ctx.color });

    const game = this.games.get(ctx.roomId!);
    if (!game) {
      log.warn("[UndoCommand.decline:game-not-found]", { playerId: ctx.playerId, roomId: ctx.roomId });
      return err(GAME_NOT_FOUND);
    }

    if (!this.consent.transition(game.id, CONSENT_DECLINE, ctx.color!)) {
      log.warn("[UndoCommand.decline:conflict]", { playerId: ctx.playerId });
      return err(PENDING_CONFLICT);
    }

    this.resolve(game.id);
    log.info("[UndoCommand.decline:declined]", { playerId: ctx.playerId, roomId: game.id });
    game.broadcast(Notifications.undoDeclined(game.id, ctx.color!));
    return ok();
  }

  cancel(ctx: PlayerContext): Result<void, GameError> {
    log.info("[UndoCommand.cancel:start]", { playerId: ctx.playerId, color: ctx.color });

    const game = this.games.get(ctx.roomId!);
    if (!game) {
      log.warn("[UndoCommand.cancel:game-not-found]", { playerId: ctx.playerId, roomId: ctx.roomId });
      return err(GAME_NOT_FOUND);
    }

    // only the requester may cancel their own request
    // CONSENT_EXPIRE is used because DECLINE/ACCEPT have a self-response guard
    const requester = this.consent.requester(game.id);
    if (requester === null || requester !== ctx.color!) {
      log.warn("[UndoCommand.cancel:not-requester]", { playerId: ctx.playerId, requester });
      return err(PENDING_CONFLICT);
    }

    if (!this.consent.transition(game.id, CONSENT_EXPIRE, ctx.color!)) {
      log.warn("[UndoCommand.cancel:conflict]", { playerId: ctx.playerId });
      return err(PENDING_CONFLICT);
    }

    this.resolve(game.id);
    log.info("[UndoCommand.cancel:cancelled]", { playerId: ctx.playerId, roomId: game.id });
    game.broadcast(Notifications.undoCancelled(game.id));
    return ok();
  }

  /** Called by ConsentManager when a pending undo request auto-expires. */
  onConsentExpired(roomId: string): void {
    this.resolve(roomId);
    const game = this.games.get(roomId);
    if (game) {
      game.broadcast(Notifications.undoExpired(roomId));
    }
  }

  clear(roomId: string): void {
    log.info("[UndoCommand.clear:clearing]", { roomId });
    this.consent.clear(roomId);
    this.pendingStamps.delete(roomId);
  }
}
