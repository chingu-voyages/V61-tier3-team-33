import { ROOM_FULL } from "../types";
import {
  BLACK,
  WHITE,
  type JoinInput,
  type Mode,
  type MoveInput,
  type PieceColor,
  type Position,
  type WebSocket,
} from "../types";
import type { Game } from "../game/game";
import type { GameStore } from "../game/game-store";
import { BLITZ } from "../types";
import { createClock } from "../clock/factory";
import { Human } from "../occupant/human";
import {
  GAME_FINISHED,
  GAME_FULL,
  NOT_AUTHENTICATED,
  NOT_IN_GAME,
  ROOM_NOT_FOUND,
} from "../protocol/errors";
import { Notifications, GRACE_EXPIRED, CONNECTION_CLOSED, GAME_ENDED } from "../protocol/events";
import type { Codec } from "../codec/codec";
import { Reply } from "../protocol/replies";
import type { SessionStore } from "../session/session-store";
import { logger as rootLogger } from "../../logging/log";
import type { GameFacade } from "./game-facade";
import type { Session } from "../session/session";
import { FAST, type Subscriber } from "../bus/bus";

const log = rootLogger.child({ module: "GameService" });

/** TTL for undo requests (30s). */
const UNDO_REQUEST_TTL_MS = 30 * 1000;
const EMOTE_COOLDOWN_MS = 30 * 1000;
const ALLOWED_EMOTES = new Set(["👍", "😅", "🤔", "🎉", "😤", "⚡"]);

/** Room the caller is leaving mid-join, so a failure can roll back. */
type SwitchingFrom = { roomId: string; color: PieceColor; mode: Mode | null };

/** Routes client actions to sessions and games. */
export class GameService implements GameFacade {
  /** roomId -> color who requested an undo. */
  private pendingUndos = new Map<string, PieceColor>();
  private lastEmoteAt = new Map<string, number>(); // `${roomId}:${color}` -> timestamp

  constructor(
    private sessions: SessionStore,
    private games: GameStore,
    private protocol: Codec,
    hub?: Subscriber,
  ) {
    if (hub) {
      hub.on(CONNECTION_CLOSED, (_rid, event) => {
        if (event.type !== CONNECTION_CLOSED) return;
        const session = this.sessions.byPlayerId(event.playerId);
        if (!session || session.disconnectedAt === null) return;
        this.notifyGraceStarted(session);
      });

      hub.on(GRACE_EXPIRED, (_rid, event) => {
        if (event.type === GRACE_EXPIRED) {
          this.handleGraceExpired(event.roomId, event.color);
        }
      });

      // FAST: avoid macrotask gap where a join() sees the finished room.
      hub.on(
        GAME_ENDED,
        (_rid, event) => {
          if (event.type === GAME_ENDED) {
            this.handleGameEnded(event.roomId);
          }
        },
        FAST,
      );
    }
  }

  /** {@inheritDoc} */
  async join(ws: WebSocket, input: JoinInput): Promise<void> {
    log.info("[GS-join-start]", { wsId: ws.id, input });
    const session = this.sessions.bySocket(ws);
    if (!session) {
      log.warn("[GS-join-no-session]", { wsId: ws.id });
      Reply.send(ws, Reply.error(NOT_AUTHENTICATED, "Session not found."));
      return;
    }

    log.info("[GS-join-session]", { playerId: session.playerId, roomId: session.roomId, color: session.color, mode: session.mode, disconnectedAt: session.disconnectedAt });

    // Room switch: remember old room, commit only if join succeeds.
    let switchingFrom: SwitchingFrom | null = null;
    if (
      session.roomId &&
      session.color !== null &&
      input.roomId !== undefined &&
      input.roomId !== session.roomId &&
      this.games.get(session.roomId)
    ) {
      log.info("[GS-join-switch-room]", { playerId: session.playerId, fromRoomId: session.roomId, toRoomId: input.roomId });
      switchingFrom = { roomId: session.roomId, color: session.color, mode: session.mode };
      this.sessions.clearSession(ws);
    }

    // Reconnect to existing game.
    if (session.roomId && session.color !== null) {
      log.info("[GS-join-reconnect-branch]", { playerId: session.playerId, roomId: session.roomId, color: session.color });
      const existing = this.games.get(session.roomId);
      if (existing) {
        log.info("[GS-join-reconnect-game-found]", { roomId: session.roomId, isFinished: existing.isFinished });

        if (!existing.isFinished) {
          log.info("[GS-join-reconnect-active]", { playerId: session.playerId, roomId: session.roomId, color: session.color });
          const occupied = existing.getOccupant(session.color);
          const occupant =
            occupied instanceof Human
              ? occupied.replaceSocket(ws)
              : new Human(session.playerId, ws, this.protocol);
          existing.reseat(session.color, occupant);

          log.info("[GS-join-reconnect-sending-snapshot]", { playerId: session.playerId, roomId: existing.id, color: session.color });

          existing.notify(
            session.color,
            Notifications.roomJoined(
              existing.id,
              session.color,
              existing.snapshot(),
            ),
          );

          const opponentColor = session.color === WHITE ? BLACK : WHITE;
          existing.notify(
            opponentColor,
            Notifications.graceCancelled(existing.id, session.color),
          );

          log.info("[GS-join-reconnect-done]", { playerId: session.playerId, roomId: existing.id, color: session.color });

          return;
        }

        // Send final snapshot so opponent can see the result.
        log.info("[GS-join-reconnect-finished]", { playerId: session.playerId, roomId: session.roomId, color: session.color });
        const occupant = new Human(session.playerId, ws, this.protocol);
        existing.reseat(session.color, occupant);

        existing.notify(
          session.color,
          Notifications.roomJoined(
            existing.id,
            session.color,
            existing.snapshot(),
          ),
        );

        return;
      }

      // Game swept or never created — clear stale session.
      log.warn("[GS-join-stale-session]", { playerId: session.playerId, staleRoomId: session.roomId, color: session.color, mode: session.mode });
      this.sessions.clearSession(ws);
      log.info("[GS-join-stale-cleared]", { playerId: session.playerId });
    }

    // Create or join a game.
    let game: Game;
    if (input.roomId) {
      const found = this.games.get(input.roomId);
      if (found) {
        game = found;
        log.info("[GS-join-invite-found]", { roomId: input.roomId, status: game.status });
      } else if (input.clock === undefined) {
        // Invite link: room must exist — creating one strands the inviter.
        log.warn("[GS-join-missing-room]", { playerId: session.playerId, roomId: input.roomId });
        if (switchingFrom) {
          this.sessions.bind(ws, switchingFrom);
        } else {
          this.sessions.clearSession(ws);
        }
        Reply.send(ws, Reply.error(ROOM_NOT_FOUND, "Room not found."));
        return;
      } else {
        // Room creator ("Play a Friend"): create with supplied id.
        log.info("[GS-join-creator]", { playerId: session.playerId, roomId: input.roomId, mode: input.mode, clock: input.clock });
        game = this.games.create(input.roomId, input.mode, createClock(input.clock));
      }
    } else {
      const format = input.clock ?? BLITZ;
      const waiting = this.games.findWaiting(input.mode, format);
      if (waiting) {
        log.info("[GS-join-matchmaking-hit]", { playerId: session.playerId, roomId: waiting.id, mode: input.mode, format });
        game = waiting;
      } else {
        log.info("[GS-join-matchmaking-create]", { playerId: session.playerId, mode: input.mode, format });
        game = this.games.create(undefined, input.mode, createClock(format));
      }
    }

    const color = input.color ?? game.nextColor();
    if (color === null) {
      log.warn("[GS-join-color-null]", { playerId: session.playerId, roomId: game.id, input });
      if (switchingFrom) {
        this.sessions.bind(ws, switchingFrom);
      }
      Reply.send(ws, Reply.error(GAME_FULL, "Game is full."));
      return;
    }

    log.info("[GS-join-occupant]", { playerId: session.playerId, roomId: game.id, color });

    const occupant = new Human(session.playerId, ws, this.protocol);
    const result = game.join(color, occupant);
    if (!result.ok) {
      if (switchingFrom) {
        this.sessions.bind(ws, switchingFrom);
      }
      if (result.error === ROOM_FULL) {
        log.warn("[GS-join-color-taken]", { playerId: session.playerId, roomId: game.id, color });
        Reply.send(ws, Reply.error(GAME_FULL, "That color is already taken."));
      } else {
        log.warn("[GS-join-game-finished]", { playerId: session.playerId, roomId: game.id, color });
        Reply.send(
          ws,
          Reply.error(GAME_FINISHED, "This game has already finished."),
        );
      }
      return;
    }

    if (switchingFrom) {
      const previous = this.games.get(switchingFrom.roomId);
      if (previous && !previous.isFinished) {
        previous.leave(switchingFrom.color);
      }
      this.pendingUndos.delete(switchingFrom.roomId);
    }

    // Use game.mode (existing room), not input.mode (joiner may send anything).
    this.sessions.bind(ws, { roomId: game.id, color, mode: game.mode });
    this.games.commit(game.id, game);

    const state = game.snapshot();

    log.info("[GS-join-success]", { playerId: session.playerId, roomId: game.id, color, fen: state.fen, turn: state.turn, isActive: game.isActive });

    game.notify(color, Notifications.roomJoined(game.id, color, state));

    if (game.isActive) {
      log.info("[GS-join-game-started]", { playerId: session.playerId, roomId: game.id, white: state.fen });
      game.broadcast(Notifications.gameStarted(game.id, state.fen, state.turn, game.timer.state));
    }
  }

  /** {@inheritDoc} */
  async move(ws: WebSocket, input: MoveInput): Promise<void> {
    const session = this.getSession(ws);
    if (!session) return;

    const game = this.getGame(ws, session);
    if (!game) return;

    const color = session.color!;

    log.info("move: input", { roomId: game.id, color, input });

    const result = await game.move(color, input);

    if (!result.ok) {
      log.warn("move: rejected", {
        roomId: game.id,
        color,
        error: result.error,
        from: input.from,
        to: input.to,
      });
      game.notify(
        color,
        Notifications.moveRejected(
          game.id,
          color,
          result.error,
          input.from,
          input.to,
        ),
      );
      return;
    }

    const snapshot = game.snapshot();

    log.info("move: output", {
      roomId: game.id,
      color,
      move: result.value,
      fen: snapshot.fen,
      turn: snapshot.turn,
    });

    game.broadcast(
      Notifications.moveMade(game.id, color, result.value, snapshot),
    );

    // Rules-ending moves don't go through resign/abandon/expire, so
    // they'd never reach handleGameEnded without this explicit call.
    if (game.isFinished) {
      this.handleGameEnded(game.id);
    }
  }

  /** {@inheritDoc} */
  async requestUndo(ws: WebSocket): Promise<void> {
    const session = this.getSession(ws);
    if (!session) return;

    const game = this.getGame(ws, session);
    if (!game) return;

    const color = session.color!;

    if (!game.isActive) {
      log.warn("requestUndo: rejected, game finished", { roomId: game.id, color });
      Reply.send(
        ws,
        Reply.error(GAME_FINISHED, "This game has already finished."),
      );
      return;
    }

    // No-op: a request is already pending.
    if (this.pendingUndos.has(game.id)) {
      log.info("requestUndo: ignored, already pending", { roomId: game.id, color });
      return;
    }

    this.pendingUndos.set(game.id, color);

    log.info("requestUndo: output", { roomId: game.id, color });

    const opponentColor = color === WHITE ? BLACK : WHITE;
    game.notify(
      opponentColor,
      Notifications.undoRequested(
        game.id,
        color,
        Date.now() + UNDO_REQUEST_TTL_MS,
      ),
    );
  }

  /** {@inheritDoc} */
  async acceptUndo(ws: WebSocket): Promise<void> {
    const session = this.getSession(ws);
    if (!session) return;

    const game = this.getGame(ws, session);
    if (!game) return;

    const color = session.color!;

    const requestedBy = this.pendingUndos.get(game.id);

    log.info("acceptUndo: input", { roomId: game.id, color, requestedBy });

    // Guard: game.undo() will reopen a finished game, so check here.
    if (!game.isActive) {
      log.warn("acceptUndo: ignored, game finished", { roomId: game.id, color });
      return;
    }

    // No pending request or accepting your own — silently ignore.
    if (requestedBy === undefined || requestedBy === color) return;

    this.pendingUndos.delete(game.id);

    const result = await game.undo();
    if (!result.ok) {
      log.warn("acceptUndo: game.undo() failed", { roomId: game.id, color });
      return;
    }

    log.info("acceptUndo: output", { roomId: game.id });

    game.broadcast(Notifications.undoApplied(game.id, game.snapshot()));
  }

  /** {@inheritDoc} */
  async declineUndo(ws: WebSocket): Promise<void> {
    const session = this.getSession(ws);
    if (!session) return;

    const game = this.getGame(ws, session);
    if (!game) return;

    const color = session.color!;

    const requestedBy = this.pendingUndos.get(game.id);

    log.info("declineUndo: input", { roomId: game.id, color, requestedBy });

    if (requestedBy === undefined || requestedBy === color) return;

    this.pendingUndos.delete(game.id);

    log.info("declineUndo: output", { roomId: game.id, color });

    game.broadcast(Notifications.undoDeclined(game.id, color));
  }

  /** {@inheritDoc} */
  async resign(ws: WebSocket): Promise<void> {
    const session = this.getSession(ws);
    if (!session) return;

    const game = this.getGame(ws, session);
    if (!game) return;

    const color = session.color!;

    log.info("resign: input", { roomId: game.id, color });

    const result = await game.resign(color);
    if (!result.ok) {
      log.warn("resign: rejected, game finished", { roomId: game.id, color });
      Reply.send(
        ws,
        Reply.error(GAME_FINISHED, "This game has already finished."),
      );
      return;
    }

    this.pendingUndos.delete(game.id);

    log.info("resign: output", { roomId: game.id, winner: result.value.winner });

    game.broadcast(
      Notifications.gameEnded(game.id, result.value, result.value.winner),
    );
  }

  /** {@inheritDoc} */
  async leave(ws: WebSocket): Promise<void> {
    const session = this.getSession(ws);
    if (!session) return;

    const game = this.getGame(ws, session);
    if (!game) return;

    const color = session.color!;

    log.info("leave: input", { roomId: game.id, color });

    game.leave(color);
    this.pendingUndos.delete(game.id);

    this.sessions.clearSession(ws);

    log.info("[GS-leave-done]", { roomId: game.id, color });
  }

  /** {@inheritDoc} */
  async sync(ws: WebSocket): Promise<void> {
    const session = this.getSession(ws);
    if (!session) return;

    const game = this.getGame(ws, session);
    if (!game) return;

    const color = session.color!;

    log.info("sync: input/output", { roomId: game.id, color });

    game.notify(
      color,
      Notifications.roomJoined(game.id, color, game.snapshot()),
    );
  }

  /** {@inheritDoc} */
  async selectPosition(ws: WebSocket, position: Position): Promise<void> {
    const session = this.getSession(ws);
    if (!session) return;

    const game = this.getGame(ws, session);
    if (!game) return;

    const color = session.color!;

    log.info("selectPosition: input", { roomId: game.id, color, position });

    const result = game.selectPosition(color, position);

    if (!result.ok) {
      log.warn("selectPosition: rejected", {
        roomId: game.id,
        color,
        position,
        error: result.error,
      });
      game.notify(
        color,
        Notifications.positionRejected(game.id, position, result.error),
      );
      return;
    }

    log.info("selectPosition: output", { roomId: game.id, color, position, value: result.value });

    game.notify(
      color,
      Notifications.positionAccepted(game.id, position, result.value),
    );
  }

  /** {@inheritDoc} */
  async sendEmote(ws: WebSocket, emote: string): Promise<void> {
    const session = this.getSession(ws);
    if (!session) return;

    const game = this.getGame(ws, session);
    if (!game) return;

    const color = session.color!;

    if (!ALLOWED_EMOTES.has(emote)) return;

    const key = `${game.id}:${color}`;
    const last = this.lastEmoteAt.get(key) ?? 0;
    if (Date.now() - last < EMOTE_COOLDOWN_MS) return;
    this.lastEmoteAt.set(key, Date.now());

    const opponentColor = color === WHITE ? BLACK : WHITE;
    game.notify(opponentColor, Notifications.emoteReceived(game.id, color, emote));
  }

  /** Notifies the opponent that grace period started for the disconnected player. */
  private notifyGraceStarted(session: Session): void {
    if (!session.roomId || session.color === null) {
      log.info("[GS-grace-started-skip-no-room]", { playerId: session.playerId, roomId: session.roomId, color: session.color });
      return;
    }
    const game = this.games.get(session.roomId);
    if (!game || !game.isActive) {
      log.info("[GS-grace-started-skip-no-game]", { playerId: session.playerId, roomId: session.roomId, color: session.color, gameFound: !!game, gameActive: game?.isActive });
      return;
    }

    const opponentColor = session.color === WHITE ? BLACK : WHITE;
    log.info("[GS-grace-started]", { roomId: session.roomId, disconnectedColor: session.color, opponentColor });
    game.notify(
      opponentColor,
      Notifications.graceStarted(game.id, session.color, Date.now()),
    );
  }

  /**
   * Grace timer expired: active game → abandon (opponent wins);
   * waiting game → vacate seat (same as leave()), so sweep() can reap it.
   */
  private handleGraceExpired(roomId: string, disconnectedColor: PieceColor): void {
    const game = this.games.get(roomId);
    if (!game) {
      log.warn("[GS-grace-expired-no-game]", { roomId, disconnectedColor });
      return;
    }

    log.info("[GS-grace-expired]", { roomId, disconnectedColor, gameActive: game.isActive, gameFinished: game.isFinished });

    if (game.isActive) {
      game.abandon(disconnectedColor);
      return;
    }

    if (!game.isFinished) {
      log.info("[GS-grace-expired-waiting-vacate]", { roomId, disconnectedColor });
      const occupant = game.getOccupant(disconnectedColor);
      game.leave(disconnectedColor);
      this.pendingUndos.delete(roomId);
      if (occupant) {
        this.sessions.clearByPlayerId(occupant.playerId, roomId);
      }
    }
  }

  /**
   * Game ended: clear undo state. Game object stays for clients to fetch
   * the final snapshot; Games.sweep() reaps it later.
   */
  private handleGameEnded(roomId: string): void {
    this.pendingUndos.delete(roomId);

    const game = this.games.get(roomId);
    if (!game) {
      log.warn("[GS-game-ended-no-game]", { roomId });
      return;
    }

    // Don't clear sessions — clients can still fetch the final snapshot.
  }

  private getSession(ws: WebSocket): Session | null {
    const session = this.sessions.bySocket(ws);
    if (!session) {
      log.warn("[GS-getSession-fail]", { wsId: ws.id });
      Reply.send(ws, Reply.error(NOT_AUTHENTICATED, "Session not found."));
      return null;
    }
    return session;
  }

  private getGame(ws: WebSocket, session: Session): Game | null {
    if (!session.roomId || session.color === null) {
      log.warn("[GS-getGame-fail-no-room]", { playerId: session.playerId, roomId: session.roomId, color: session.color });
      Reply.send(ws, Reply.error(NOT_IN_GAME, "You are not in a game."));
      return null;
    }

    const game = this.games.get(session.roomId);
    if (!game) {
      log.warn("[GS-getGame-fail-missing]", { playerId: session.playerId, roomId: session.roomId });
      Reply.send(ws, Reply.error(ROOM_NOT_FOUND, "Room not found."));
      return null;
    }

    return game;
  }
}
