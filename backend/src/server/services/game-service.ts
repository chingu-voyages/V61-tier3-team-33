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
import { Notifications, GRACE_EXPIRED, CONNECTION_CLOSED } from "../protocol/events";
import type { Codec } from "../codec/codec";
import { Reply } from "../protocol/replies";
import type { SessionStore } from "../session/session-store";
import { logger as rootLogger } from "../../logging/log";
import type { GameFacade } from "./game-facade";
import type { Session } from "../session/session";
import type { Subscriber } from "../bus/bus";

const log = rootLogger.child({ module: "GameService" });

/** How long an undo request stays valid; only seeds `expiresAt`, not enforced yet. */
const UNDO_REQUEST_TTL_MS = 30 * 1000;

/** Orchestrates client actions against sessions and games; wire-level only, no game rules. */
export class GameService implements GameFacade {
  /**
   * roomId -> color who requested an undo. Lives here, not on `Game`,
   * since it's a service-level handshake, not part of game rules.
   */
  private pendingUndos = new Map<string, PieceColor>();

  constructor(
    private sessions: SessionStore,
    private games: GameStore,
    private protocol: Codec,
    hub?: Subscriber,
  ) {
    if (hub) {
      // Connections handles the grace timer lifecycle (start on close,
      // cancel on resume). GameService just notifies the opponent.
      hub.on(CONNECTION_CLOSED, (_rid, event) => {
        if (event.type !== CONNECTION_CLOSED) return;
        const session = this.sessions.byPlayerId(event.playerId);
        // Guard: player may have already reconnected (DEFERRED race)
        if (!session || session.disconnectedAt === null) return;
        this.notifyGraceStarted(session);
      });

      hub.on(GRACE_EXPIRED, (_rid, event) => {
        if (event.type === GRACE_EXPIRED) {
          this.handleGraceExpired(event.roomId, event.color);
        }
      });
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

    // Explicit roomId different from session's current room: this is a
    // room switch, not a reconnect. Remember the old room but don't leave
    // it yet — only commit once the new join succeeds. If the old room no
    // longer exists, there's nothing to switch from or roll back to — fall
    // through to the stale-session cleanup below instead.
    let switchingFrom: { roomId: string; color: PieceColor; mode: Mode | null } | null = null;
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

    // Rejoin on reconnect.
    if (session.roomId && session.color !== null) {
      log.info("[GS-join-reconnect-branch]", { playerId: session.playerId, roomId: session.roomId, color: session.color });
      const existing = this.games.get(session.roomId);
      if (existing) {
        log.info("[GS-join-reconnect-game-found]", { roomId: session.roomId, isFinished: existing.isFinished });

        // Reconnect timer is cancelled by Connections.identify() on resume.
        // Notify the opponent the player is back.
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

        // Game is finished — still send the final snapshot so the
        // reconnecting player can see the result.
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

      // Game was swept or never created — clear stale session state so the
      // player can join a new room (or be told the room doesn't exist)
      // instead of silently falling through into matchmaking.
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
        // Joining via an invite link must target an existing room —
        // creating one here would silently strand the inviter.
        log.warn("[GS-join-missing-room]", { playerId: session.playerId, roomId: input.roomId });
        if (switchingFrom) {
          this.sessions.bind(ws, switchingFrom);
        } else {
          this.sessions.clearSession(ws);
        }
        Reply.send(ws, Reply.error(ROOM_NOT_FOUND, "Room not found."));
        return;
      } else {
        // First join with a client-supplied id and an explicit clock
        // format: this is the room creator (e.g. "Play a Friend"), so
        // create the room using that id.
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

    this.sessions.bind(ws, { roomId: game.id, color, mode: input.mode });
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

    // No-op if a request is already pending (either side) — the opponent
    // should accept/decline the existing one instead.
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

    // No pending request, or you can't accept your own — silently ignore
    // rather than invent a dedicated error code for a stale client action.
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

  /** Called when a grace timer expires — abandons the game on behalf of the disconnected player. */
  private handleGraceExpired(roomId: string, disconnectedColor: PieceColor): void {
    const game = this.games.get(roomId);
    if (!game) {
      log.warn("[GS-grace-expired-no-game]", { roomId, disconnectedColor });
      return;
    }

    log.info("[GS-grace-expired]", { roomId, disconnectedColor, gameActive: game.isActive, gameFinished: game.isFinished });
    game.abandon(disconnectedColor);
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
