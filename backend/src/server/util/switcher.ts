import { logger as rootLogger } from "../../logging/logger";
import type { GameReader } from "../store/game/game-store";
import type { SessionWriter } from "../store/session/session-store";
import { Context, type JoinInput, type PlayerContext, type WebSocket } from "../types";
import type { SwitchingFrom } from "../types/game";

const log = rootLogger.child({ module: "RoomSwitcher" });

/** Three-phase room switch protocol. Stateless — every call passes `SwitchingFrom` explicitly. */
export interface Switcher {
  /** Snapshot current room before switching to a different one. Returns null if no switch is needed. */
  capture(ctx: PlayerContext, input: JoinInput, ws: WebSocket): SwitchingFrom | null;

  /** Restore the session to the original room after a failed join. */
  rollback(from: SwitchingFrom | null, ws: WebSocket): void;

  /** Leave the old room after a successful join. */
  commit(from: SwitchingFrom | null): void;
}

export class RoomSwitcher implements Switcher {
  constructor(
    private games: GameReader,
    private sessions: SessionWriter,
  ) {
    // log room switcher initialization
    log.info("[RoomSwitcher.constructor:init]");
  }

  /** Snapshot the current room if the player is switching to a different one. */
  capture(ctx: PlayerContext, input: JoinInput, ws: WebSocket): SwitchingFrom | null {
    // skip if player is not in a game
    if (!Context.inGame(ctx)) {
      log.info("[RoomSwitcher.capture:not-in-game]", { playerId: ctx.playerId, wsId: ws.id });
      return null;
    }

    // skip if request targets the same room we're already in.
    const switchingRooms = input.roomId !== ctx.roomId;
    if (!switchingRooms) {
      log.info("[RoomSwitcher.capture:same-room]", { playerId: ctx.playerId, roomId: ctx.roomId, wsId: ws.id });
      return null;
    }

    // skip if the current game no longer exists
    if (!this.games.get(ctx.roomId)) {
      log.warn("[RoomSwitcher.capture:game-not-found]", { playerId: ctx.playerId, roomId: ctx.roomId, wsId: ws.id });
      return null;
    }

    // capture current room state and clear session binding
    const from: SwitchingFrom = { roomId: ctx.roomId, color: ctx.color, mode: ctx.mode };
    this.sessions.clearSession(ws);
    log.info("[RoomSwitcher.capture:captured]", {
      playerId: ctx.playerId,
      from,
      targetRoomId: input.roomId,
      wsId: ws.id,
    });
    return from;
  }

  /** Undo capture: rebind the session to the original room. Called on join failure. */
  rollback(from: SwitchingFrom | null, ws: WebSocket): void {
    if (!from) {
      log.info("[RoomSwitcher.rollback:noop]", { wsId: ws.id });
      return;
    }

    log.info("[RoomSwitcher.rollback:rolling-back]", {
      roomId: from.roomId,
      color: from.color,
      mode: from.mode,
      wsId: ws.id,
    });
    this.sessions.bind(ws, from);
  }

  /** Finalise: leave the old room. Caller handles undo cleanup separately. */
  commit(from: SwitchingFrom | null): void {
    if (!from) {
      log.info("[RoomSwitcher.commit:noop]");
      return;
    }

    const previous = this.games.get(from.roomId);
    if (!previous || previous.isFinished) {
      log.info("[RoomSwitcher.commit:skip-leave]", {
        roomId: from.roomId,
        color: from.color,
        gameExists: Boolean(previous),
        isFinished: previous?.isFinished,
      });
      return;
    }

    log.info("[RoomSwitcher.commit:leaving]", { roomId: from.roomId, color: from.color });
    previous.leave(from.color);
  }
}
